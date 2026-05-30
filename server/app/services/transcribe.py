
"""语音转文字服务 - 使用 faster-whisper (优化版)

优化点:
  1. 使用 faster-whisper (CTranslate2) 替代 openai-whisper: CPU推理速度提升3-4倍
  2. 模型降级: WHISPER_MODEL 环境变量 (默认 tiny, 可选 tiny/base/small/medium)
  3. int8 量化: compute_type=int8, 速度翻倍, 内存减半
  4. 延迟加载 + 线程池, 不阻塞事件循环
  5. VAD 增强: 静音自动跳过推理
"""
import os
# 禁止 faster-whisper 连接 HuggingFace Hub（离线模式 + 镜像源）
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
import tempfile
import base64
import logging
import time

logger = logging.getLogger("lingjing.transcribe")
import asyncio
import threading

_t2s = None

def _get_t2s():
    global _t2s
    if _t2s is None:
        try:
            from opencc import OpenCC
            _t2s = OpenCC('t2s')
        except Exception:
            logger.warning("加载OpenCC繁简转换失败，使用原文", exc_info=True)
            _t2s = False
    return _t2s if _t2s is not False else None

def _to_simplified(text: str) -> str:
    cc = _get_t2s()
    if cc is None:
        return text
    try:
        return cc.convert(text)
    except Exception:
        logger.warning("繁简转换失败，使用原文", exc_info=True)
        return text

_model = None
_model_name = os.environ.get("WHISPER_MODEL", "tiny")
_load_lock = threading.Lock()
_is_loading = False
_load_error = None
_MODEL_PATH = os.environ.get("WHISPER_MODEL_PATH", "")

def _load_model_sync():
    global _model
    from faster_whisper import WhisperModel
    t0 = time.time()
    model_id = _MODEL_PATH or _model_name
    # 构建本地模型缓存路径
    _local_cache = os.path.join(os.path.expanduser("~"), ".cache", "faster-whisper", model_id)
    if os.path.isdir(_local_cache):
        model_id = _local_cache
        logger.info(f"使用本地缓存模型: {model_id}")
    else:
        logger.info(f"尝试在线加载模型: {model_id} (若网络不通, 请将模型下载到 {_local_cache})")
    logger.info(f"加载 faster-whisper 模型: device=cpu, compute_type=int8 ...")
    _model = WhisperModel(model_id, device="cpu", compute_type="int8",
                          local_files_only=False, cpu_threads=1)
    elapsed = time.time() - t0
    logger.info(f"faster-whisper 模型加载完成 (耗时 {elapsed:.1f}s)")


async def preload_model():
    global _is_loading, _load_error
    if _model is not None:
        return
    with _load_lock:
        if _is_loading:
            return
        _is_loading = True
    try:
        loop = asyncio.get_event_loop()
        t0 = time.time()
        logger.info("faster-whisper 模型加载开始 (线程池)...")
        await loop.run_in_executor(None, _load_model_sync)
        elapsed = time.time() - t0
        logger.info(f"faster-whisper 模型就绪 (总耗时 {elapsed:.1f}s)")
    except Exception as e:
        _load_error = str(e)
        logger.error(f"faster-whisper 模型加载失败: {e}")
        raise
    finally:
        _is_loading = False


def _get_model():
    if _model is None:
        _load_model_sync()
    return _model


async def _get_model_async():
    if _model is None:
        await preload_model()
    return _model


def is_model_ready() -> bool:
    return _model is not None


def get_model_name() -> str:
    return _model_name


def _has_gpu() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def _extract_text(segments, info) -> str:
    texts = []
    try:
        for seg in segments:
            if seg.text and seg.text.strip():
                texts.append(seg.text.strip())
    except Exception as e:
        logger.warning(f"提取 segments 文本异常: {e}")
    return "".join(texts)


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    suffix = os.path.splitext(filename)[1] or ".m4a"
    if not audio_bytes or len(audio_bytes) < 44:
        logger.warning(f"音频数据为空或过小: {len(audio_bytes) if audio_bytes else 0} bytes")
        return "[语音数据为空，请重新录音]"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        model = _get_model()
        file_size = os.path.getsize(tmp_path)
        logger.info(f"开始转写 (faster-whisper): {tmp_path} ({file_size} bytes)")
        t0 = time.time()

        segments, info = model.transcribe(
            tmp_path,
            language="zh",
            task="transcribe",
            beam_size=1,
            best_of=1,
            vad_filter=True,
            vad_parameters=dict(
                threshold=0.5,
                min_speech_duration_ms=250,
                min_silence_duration_ms=500,
            ),
            temperature=0.0,
            compression_ratio_threshold=2.4,
            initial_prompt="以下是普通话的句子：简体中文",
        )
        elapsed = time.time() - t0
        text = _extract_text(segments, info)
        text = _to_simplified(text)
        logger.info(f"转写完成 ({elapsed:.1f}s, 语言={info.language}, 概率={info.language_probability:.2f}): {repr(text[:80])}")
        return text if text else "[无法识别语音内容]"
    except Exception as e:
        logger.error(f"转写失败: {e}")
        if suffix == '.m4a' and 'ffmpeg' in str(e).lower():
            try:
                logger.info(f"m4a解码失败，尝试wav格式: {filename}")
                import wave
                wav_path = tmp_path.replace('.m4a', '.wav')
                with wave.open(wav_path, 'wb') as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(16000)
                    wf.writeframes(audio_bytes)
                segments, info = model.transcribe(
                    wav_path, language="zh", task="transcribe",
                    beam_size=1, best_of=1, vad_filter=True,
                    temperature=0.0,
                    initial_prompt="以下是普通话的句子：简体中文",
                )
                text = _extract_text(segments, info)
                text = _to_simplified(text)
                logger.info(f"wav备选转写完成: {repr(text[:80])}")
                return text if text else "[无法识别语音内容]"
            except Exception as e2:
                logger.error(f"wav备选也失败: {e2}")
        raise
    finally:
        try:
            os.unlink(tmp_path)
        except OSError as e:
            logger.warning(f"转写临时文件清理失败 [{tmp_path}]: {e}")


async def transcribe_audio_bytes_async(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, transcribe_audio_bytes, audio_bytes, filename)


def transcribe_base64(base64_audio: str, filename: str = "audio.m4a") -> str:
    if "," in base64_audio:
        base64_audio = base64_audio.split(",", 1)[1]
    audio_bytes = base64.b64decode(base64_audio)
    return transcribe_audio_bytes(audio_bytes, filename)


_STREAM_SAMPLE_RATE = 16000
_STREAM_CHUNK_MS = 320
_STREAM_CHUNK_BYTES = int(_STREAM_SAMPLE_RATE * 0.32 * 2)
_STREAM_INTERVAL_FRAMES = max(1, 1000 // _STREAM_CHUNK_MS)
_INTERIM_SEGMENT_SEC = 3.0

_vad = None
_vad_lock = threading.Lock()

def _get_vad():
    global _vad
    if _vad is None:
        with _vad_lock:
            if _vad is None:
                try:
                    import webrtcvad
                    _vad = webrtcvad.Vad(3)
                    logger.info("VAD 加载成功 (webrtcvad, aggressiveness=3)")
                except ImportError:
                    logger.warning("webrtcvad 未安装，VAD 已禁用")
                    _vad = False
    return _vad if _vad is not False else None


def is_speech(pcm_frame: bytes, sample_rate: int = 16000) -> bool:
    vad = _get_vad()
    if vad is None:
        return True
    try:
        return vad.is_speech(pcm_frame, sample_rate)
    except Exception:
        return True


def _pcm_to_wav(pcm: bytes, sample_rate: int = _STREAM_SAMPLE_RATE) -> bytes:
    import wave
    import io as _io
    buf = _io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


class StreamingTranscriber:
    def __init__(self, max_buffer_sec: float = 60.0):
        self._buffer = bytearray()
        self._chunk_count = 0
        self._last_interim_text = ""
        self._max_buffer = int(_STREAM_SAMPLE_RATE * 2 * max_buffer_sec)
        self._loop = None
        self._has_speech_ever = False
        self._speech_ratio = 0.0
        self._total_frames = 0
        self._speech_frames = 0

    async def add_chunk(self, chunk: bytes) -> None:
        if not chunk:
            return
        self._buffer.extend(chunk)
        self._chunk_count += 1
        self._total_frames += 1
        if _get_vad() is not None:
            frame_size = int(0.03 * _STREAM_SAMPLE_RATE * 2)
            for i in range(0, len(chunk), frame_size):
                frame = chunk[i:i + frame_size]
                if len(frame) == frame_size:
                    if is_speech(frame, _STREAM_SAMPLE_RATE):
                        self._speech_frames += 1
                        if not self._has_speech_ever:
                            self._has_speech_ever = True
        self._speech_ratio = self._speech_frames / max(1, self._total_frames)
        if len(self._buffer) > self._max_buffer:
            keep = int(_STREAM_SAMPLE_RATE * 2 * 30)
            self._buffer = self._buffer[-keep:]

    async def transcribe_interim(self) -> str | None:
        if len(self._buffer) < _STREAM_SAMPLE_RATE * 2 * 1:
            return None
        if _get_vad() is not None:
            recent_speech = False
            segment_bytes = int(_STREAM_SAMPLE_RATE * 2 * _INTERIM_SEGMENT_SEC)
            recent = bytes(self._buffer[-segment_bytes:]) if len(self._buffer) > segment_bytes else bytes(self._buffer)
            frame_size = int(0.03 * _STREAM_SAMPLE_RATE * 2)
            for i in range(0, len(recent), frame_size):
                frame = recent[i:i + frame_size]
                if len(frame) == frame_size and is_speech(frame, _STREAM_SAMPLE_RATE):
                    recent_speech = True
                    break
            if not recent_speech:
                return None
        segment_bytes = int(_STREAM_SAMPLE_RATE * 2 * _INTERIM_SEGMENT_SEC)
        segment = bytes(self._buffer[-segment_bytes:]) if len(self._buffer) > segment_bytes else bytes(self._buffer)
        text = await self._transcribe_async(segment)
        if not text:
            return None
        delta = text
        if self._last_interim_text and text.startswith(self._last_interim_text):
            delta = text[len(self._last_interim_text):].strip()
        elif self._last_interim_text:
            delta = text
        if not delta:
            return None
        self._last_interim_text = text
        return delta

    async def _transcribe_async(self, pcm: bytes) -> str:
        try:
            wav = _pcm_to_wav(pcm)
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, transcribe_audio_bytes, wav, "stream.wav")
        except Exception as e:
            logger.warning(f"流式 interim 转写失败: {e}")
            return ""

    async def finalize(self) -> str:
        if len(self._buffer) < _STREAM_SAMPLE_RATE * 2 * 0.3:
            return ""
        if _get_vad() is not None and not self._has_speech_ever:
            logger.info(f"VAD 跳过全量转写: 全程未检测到语音")
            return ""
        full_pcm = bytes(self._buffer)
        wav = _pcm_to_wav(full_pcm)
        try:
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(None, transcribe_audio_bytes, wav, "stream_final.wav")
            return text
        except Exception as e:
            logger.error(f"流式最终转写失败: {e}")
            return ""

    @property
    def buffer_duration_sec(self) -> float:
        return len(self._buffer) / (_STREAM_SAMPLE_RATE * 2)

    @property
    def is_empty(self) -> bool:
        return len(self._buffer) < _STREAM_SAMPLE_RATE * 2 * 0.3
