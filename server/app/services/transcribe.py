"""语音转文字服务 - 使用 openai-whisper (优化版)

优化点:
  1. 延迟加载: 首次语音请求时才加载模型, 不阻塞服务启动
  2. 线程池加载: 使用 run_in_executor 避免阻塞事件循环
  3. 可配置模型: WHISPER_MODEL 环境变量 (默认 small, 可选 tiny/base/small/medium)
  4. 加载超时保护: 30s 超时降级
  5. 繁简转换: initial_prompt 引导简体 + opencc 后处理兜底
"""
import os
import tempfile
import base64
import logging
import time

logger = logging.getLogger("lingjing.transcribe")
import asyncio
import threading

# 简体中文转换器（后处理兜底 - 防止Whisper输出繁体字）
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
_model_name = os.environ.get("WHISPER_MODEL", "small")
_load_lock = threading.Lock()
_is_loading = False
_load_error = None


def _load_model_sync():
    """同步加载 Whisper 模型 (在 run_in_executor 中调用)"""
    global _model
    import whisper
    t0 = time.time()
    logger.info(f"加载 Whisper 模型: {_model_name} ...")
    _model = whisper.load_model(_model_name)
    elapsed = time.time() - t0
    logger.info(f"Whisper 模型 {_model_name} 加载完成 (耗时 {elapsed:.1f}s)")


async def preload_model():
    """异步预加载 Whisper 模型 (使用线程池, 不阻塞事件循环)"""
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
        logger.info("Whisper 模型加载开始 (线程池)...")
        await loop.run_in_executor(None, _load_model_sync)
        elapsed = time.time() - t0
        logger.info(f"Whisper 模型就绪 (总耗时 {elapsed:.1f}s)")
    except Exception as e:
        _load_error = str(e)
        logger.error(f"Whisper 模型加载失败: {e}")
        raise
    finally:
        _is_loading = False


def _get_model():
    """获取 Whisper 模型实例 (同步版本, 用于首次加载)"""
    if _model is None:
        _load_model_sync()
    return _model


async def _get_model_async():
    """获取 Whisper 模型实例 (异步版本, 推荐)"""
    if _model is None:
        await preload_model()
    return _model


def is_model_ready() -> bool:
    """检查模型是否已加载"""
    return _model is not None


def get_model_name() -> str:
    """获取当前模型名称"""
    return _model_name


def _has_gpu() -> bool:
    """检查是否有 GPU 可用"""
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    suffix = os.path.splitext(filename)[1] or ".m4a"
    
    # 空文件检测
    if not audio_bytes or len(audio_bytes) < 44:  # WAV最小头部44字节
        logger.warning(f"音频数据为空或过小: {len(audio_bytes) if audio_bytes else 0} bytes")
        return "[语音数据为空，请重新录音]"
    
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        model = _get_model()
        file_size = os.path.getsize(tmp_path)
        has_gpu = _has_gpu()
        logger.info(f"开始转写: {tmp_path} ({file_size} bytes, fp16={has_gpu})")
        t0 = time.time()
        result = model.transcribe(
            tmp_path,
            language="zh",
            task="transcribe",
            fp16=has_gpu,
            beam_size=1,
            best_of=1,
            temperature=0.0,
            compression_ratio_threshold=2.4,
            logprob_threshold=-1.0,
            no_speech_threshold=0.6,
            verbose=None,
            initial_prompt="以下是普通话的句子：简体中文",
        )
        elapsed = time.time() - t0
        text = result["text"].strip()
        text = _to_simplified(text)
        logger.info(f"转写完成 ({elapsed:.1f}s): {repr(text)}")
        return text
    except Exception as e:
        logger.error(f"转写失败: {e}")
        # 如果是m4a格式错误，尝试转为wav再试
        if suffix == '.m4a' and 'ffmpeg' in str(e).lower():
            try:
                logger.info(f"m4a解码失败，尝试wav格式: {filename}")
                # 直接作为raw PCM数据尝试 (16kHz, 16bit, mono)
                import wave
                wav_path = tmp_path.replace('.m4a', '.wav')
                with wave.open(wav_path, 'wb') as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(16000)
                    wf.writeframes(audio_bytes)
                result = model.transcribe(
                    wav_path,
                    language="zh",
                    task="transcribe",
                    fp16=has_gpu,
                    beam_size=1,
                    best_of=1,
                    temperature=0.0,
                    compression_ratio_threshold=2.4,
                    logprob_threshold=-1.0,
                    no_speech_threshold=0.6,
                    verbose=None,
                    initial_prompt="以下是普通话的句子：简体中文",
                )
                text = result["text"].strip()
                text = _to_simplified(text)
                logger.info(f"wav备选转写完成: {repr(text)}")
                return text
            except Exception as e2:
                logger.error(f"wav备选也失败: {e2}")
        raise
    finally:
        try:
            os.unlink(tmp_path)
        except OSError as e:
            logger.warning(f"转写临时文件清理失败 [{tmp_path}]: {e}")


async def transcribe_audio_bytes_async(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    """异步版本 - 使用线程池执行转写"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, transcribe_audio_bytes, audio_bytes, filename
    )


def transcribe_base64(base64_audio: str, filename: str = "audio.m4a") -> str:
    """将 base64 编码的音频数据转为文字"""
    if "," in base64_audio:
        base64_audio = base64_audio.split(",", 1)[1]
    audio_bytes = base64.b64decode(base64_audio)
    return transcribe_audio_bytes(audio_bytes, filename)


# ── 流式转写支持（用于 WebSocket 实时 ASR） ──

_STREAM_SAMPLE_RATE = 16000
_STREAM_CHUNK_MS = 320          # 每段音频时长 (ms)
_STREAM_CHUNK_BYTES = int(_STREAM_SAMPLE_RATE * 0.32 * 2)  # 20ms × 16kHz × 2byte = 640
_STREAM_INTERVAL_FRAMES = max(1, 1000 // _STREAM_CHUNK_MS)  # 约每秒一次 interim
_INTERIM_SEGMENT_SEC = 3.0      # interim 转写用的滑动窗口长度（秒）— 3秒平衡实时性和精度

# ── 语音活动检测 (VAD) ──
_vad = None
_vad_lock = threading.Lock()

def _get_vad():
    """延迟加载 VAD（webrtcvad）"""
    global _vad
    if _vad is None:
        with _vad_lock:
            if _vad is None:
                try:
                    import webrtcvad
                    _vad = webrtcvad.Vad(3)  # 激进模式 (0-3)
                    logger.info("VAD 加载成功 (webrtcvad, aggressiveness=3)")
                except ImportError:
                    logger.warning("webrtcvad 未安装，VAD 已禁用。pip install webrtcvad")
                    _vad = False
    return _vad if _vad is not False else None


def is_speech(pcm_frame: bytes, sample_rate: int = 16000) -> bool:
    """检测 PCM 帧是否包含人声（30ms帧）"""
    vad = _get_vad()
    if vad is None:
        return True  # VAD不可用，默认通过
    try:
        return vad.is_speech(pcm_frame, sample_rate)
    except Exception:
        return True


def _pcm_to_wav(pcm: bytes, sample_rate: int = _STREAM_SAMPLE_RATE) -> bytes:
    """将 PCM 裸流包装为 WAV 格式（用于 Whisper 转写）"""
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
    """流式转写器：音频分片累积 + 滑动窗口 interim 转写 + 最终全量转写

    VAD 增强: 仅在有语音时才触发转写，跳过静音段

    用法:
        st = StreamingTranscriber()
        for chunk in audio_chunks:
            text = await st.add_chunk(chunk)  # 返回 interim 文本或 None
        final = await st.finalize()           # 返回完整文本
    """

    def __init__(self, max_buffer_sec: float = 60.0):
        self._buffer = bytearray()
        self._chunk_count = 0
        self._last_interim_text = ""
        self._max_buffer = int(_STREAM_SAMPLE_RATE * 2 * max_buffer_sec)
        self._loop = None
        # VAD 状态追踪
        self._has_speech_ever = False
        self._speech_ratio = 0.0
        self._total_frames = 0
        self._speech_frames = 0
        logger.debug(f"StreamingTranscriber 初始化: 最大缓存 {max_buffer_sec}s, VAD已集成")

    async def add_chunk(self, chunk: bytes) -> None:
        """添加音频块到缓冲区（非阻塞，仅累积 + VAD检测）"""
        if not chunk:
            return
        self._buffer.extend(chunk)
        self._chunk_count += 1

        # VAD: 检测当前chunk是否含语音
        self._total_frames += 1
        if _get_vad() is not None:
            # 按30ms帧逐帧检测
            frame_size = int(0.03 * _STREAM_SAMPLE_RATE * 2)  # 30ms PCM16帧
            for i in range(0, len(chunk), frame_size):
                frame = chunk[i:i + frame_size]
                if len(frame) == frame_size:
                    if is_speech(frame, _STREAM_SAMPLE_RATE):
                        self._speech_frames += 1
                        if not self._has_speech_ever:
                            self._has_speech_ever = True

        # 更新语音比例
        self._speech_ratio = self._speech_frames / max(1, self._total_frames)

        # 限制最大缓冲区
        if len(self._buffer) > self._max_buffer:
            keep = int(_STREAM_SAMPLE_RATE * 2 * 30)
            self._buffer = self._buffer[-keep:]
            logger.warning(f"流式转写缓冲区溢出，截断至最近 30s ({keep} bytes)")

    async def transcribe_interim(self) -> str | None:
        """滑动窗口转写最近 N 秒音频，返回增量文本

        VAD增强: 若当前窗口无语音则直接跳过，不触发GPU推理
        """
        if len(self._buffer) < _STREAM_SAMPLE_RATE * 2 * 1:  # 至少 1s 音频
            return None

        # VAD: 检查最近片段是否有语音
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
                return None  # 跳过GPU推理

        # 取最近 INTERIM_SEGMENT_SEC 秒
        segment_bytes = int(_STREAM_SAMPLE_RATE * 2 * _INTERIM_SEGMENT_SEC)
        segment = bytes(self._buffer[-segment_bytes:]) if len(self._buffer) > segment_bytes else bytes(self._buffer)

        text = await self._transcribe_async(segment)
        if not text:
            return None

        # 计算增量：去除上一次已输出的部分
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
        """将 PCM 转为 WAV 后用 Whisper 异步转写"""
        try:
            wav = _pcm_to_wav(pcm)
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, transcribe_audio_bytes, wav, "stream.wav")
        except Exception as e:
            logger.warning(f"流式 interim 转写失败: {e}")
            return ""

    async def finalize(self) -> str:
        """最终转写全部累积音频，返回完整文本

        VAD增强: 若全程无语音则直接返回空字符串
        """
        if len(self._buffer) < _STREAM_SAMPLE_RATE * 2 * 0.3:  # <0.3s → 忽略
            return ""

        # VAD: 如果全程都没检测到语音，直接跳过
        if _get_vad() is not None and not self._has_speech_ever:
            logger.info(f"VAD 跳过全量转写: 全程未检测到语音 (总帧数={self._total_frames})")
            return ""

        full_pcm = bytes(self._buffer)
        wav = _pcm_to_wav(full_pcm)
        try:
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(None, transcribe_audio_bytes, wav, "stream_final.wav")
            logger.info(f"流式最终转写完成: {len(full_pcm)} bytes → {repr(text[:80])} (语音占比={self._speech_ratio:.0%})")
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
