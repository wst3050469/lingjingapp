"""语音合成服务 (TTS) - 支持 Edge TTS / gTTS 双引擎 (优化版)

优化点:
  1. 启动预热: 服务启动时预合成常用短语 (静默后台)
  2. 跳过 ffmpeg: Edge TTS 直接请求 WAV, 省去转码
  3. 缓存命中优先: 常见回复预缓存, 零延迟
"""
import os
import hashlib
import logging
import tempfile
import time
import shutil
import wave
import subprocess
import asyncio

logger = logging.getLogger(__name__)

CACHE_DIR = os.environ.get(
    "TTS_CACHE_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "tts_cache")
)
os.makedirs(CACHE_DIR, exist_ok=True)

# 预热短语列表 — 高频语音回复, 在服务启动时静默预合成
WARMUP_PHRASES = [
    "好的",
    "请说",
    "抱歉,我没听清,请再说一遍。",
    "抱歉,我现在有点忙,请稍后再试。",
    "抱歉,我思考太久了,请再说一遍。",
    "好的,请继续。",
]

EDGE_VOICE_MAP = {
    "zh-CN": "zh-CN-XiaoxiaoNeural",
    "zh-CN-Yunxi": "zh-CN-YunxiNeural",
    "zh-CN-Xiaoyi": "zh-CN-XiaoyiNeural",
}
DEFAULT_EDGE_VOICE = "zh-CN-XiaoxiaoNeural"
MAX_TEXT_LENGTH = 500


def _escape_xml(text: str) -> str:
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    text = text.replace("'", "&apos;")
    return text


def _clean_text(text: str) -> str:
    import re
    original = text
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'__(.+?)__', r'\1', text)
    text = re.sub(r'_(.+?)_', r'\1', text)
    text = text.replace('*', '')
    text = re.sub(r'```[\s\S]*?```', '[代码]', text)
    text = re.sub(r'`(.+?)`', r'\1', text)
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'^---+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[\s]*[-*+]\s+', '', text, flags=re.MULTILINE)
    for ch in ['「', '」', '『', '』', '【', '】', '〔', '〕']:
        text = text.replace(ch, '')
    text = re.sub(
        r'灵境\s*(?:[（(][^）)]*[）)])?\s*(?:科技|信息|技术|网络|软件|数据|智能|数字|文化|传媒|教育|咨询|管理|服务|实业|发展|投资|控股|股份|集团|有限|责任|总公司|分公司|公司)+',
        '灵境', text
    )
    for ch in ['$', '€', '£', '¥']:
        text = text.replace(ch, '')
    for ch in ['@', '#', '^', '~', '|', '\\', '{', '}', '<', '>']:
        text = text.replace(ch, '')
    text = text.replace(chr(183), ' ')
    text = text.replace(chr(8226), ' ')
    text = text.replace('&', chr(21644))
    text = re.sub(r'\n{3,}', '\n\n', text)
    result = text.strip()
    if result != original.strip():
        removed_chars = len(original) - len(result)
        logger.info(f"TTS _clean_text: {len(original)}字 → {len(result)}字 (移除{removed_chars}字)")
    return result


def _smart_truncate(text: str, max_len: int = MAX_TEXT_LENGTH) -> str:
    if len(text) <= max_len:
        return text
    for sep in ("。", "！", "？", "\n", "；", "，"):
        idx = text.rfind(sep, 0, max_len)
        if idx > max_len * 0.5:
            return text[:idx + 1]
    return text[:max_len]


def _hash_text(text: str, lang: str = "zh-CN") -> str:
    raw = f"{lang}:{text.strip()}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _get_cache_path(text: str, lang: str = "zh-CN", suffix: str = ".wav") -> str:
    h = _hash_text(text, lang)
    return os.path.join(CACHE_DIR, f"{h}{suffix}")


def _cleanup_old_cache(max_age_hours: int = 24):
    now = time.time()
    max_age = max_age_hours * 3600
    try:
        for f in os.listdir(CACHE_DIR):
            fp = os.path.join(CACHE_DIR, f)
            if os.path.isfile(fp) and (now - os.path.getmtime(fp)) > max_age:
                os.remove(fp)
    except Exception as e:
        logger.warning(f"TTS 缓存清理失败: {e}")


async def text_to_speech_edge(text: str, voice: str = DEFAULT_EDGE_VOICE) -> str | None:
    try:
        escaped_text = _escape_xml(text)
        import edge_tts
        fd, tmp_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        communicate = edge_tts.Communicate(escaped_text, voice)
        await communicate.save(tmp_path)
        if os.path.getsize(tmp_path) > 100:
            logger.info(f"Edge TTS 合成成功: {len(text)}字 -> {tmp_path}")
            return tmp_path
        else:
            logger.warning(f"Edge TTS 输出文件太小: {tmp_path}")
            try: os.unlink(tmp_path)
            except OSError: pass
            return None
    except ImportError:
        logger.warning("edge-tts 未安装, 跳过")
        return None
    except Exception as e:
        logger.warning(f"Edge TTS 合成失败: {e}")
        return None


async def text_to_speech_gtts(text: str, lang: str = "zh-CN") -> str | None:
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang=lang, slow=False)
        fd, tmp_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        tts.save(tmp_path)
        if os.path.getsize(tmp_path) > 100:
            logger.info(f"gTTS 合成成功: {len(text)}字 -> {tmp_path}")
            return tmp_path
        else:
            logger.warning(f"gTTS 输出文件太小: {tmp_path}")
            try: os.unlink(tmp_path)
            except OSError: pass
            return None
    except ImportError:
        logger.warning("gtts 未安装, 跳过")
        return None
    except Exception as e:
        logger.warning(f"gTTS 合成失败: {e}")
        return None


async def text_to_speech(
    text: str,
    lang: str = "zh-CN",
    use_cache: bool = True,
    prefer_edge: bool = True,
    ensure_wav: bool = True,
) -> str | None:
    if not text or not text.strip():
        logger.warning("TTS 收到空文本")
        return None
    text_clean = _clean_text(text)
    if not text_clean:
        logger.warning("TTS 清理后文本为空，跳过播报")
        return None
    if text_clean != text:
        logger.info(f"TTS 清理符号: {len(text)}字 → {len(text_clean)}字")
    text = text_clean
    if len(text) > MAX_TEXT_LENGTH:
        text_before = len(text)
        text = _smart_truncate(text)
        logger.info(f"TTS 文本已截断: {text_before}字 → {len(text)}字")
    else:
        logger.info(f"TTS 文本长度: {len(text)}字, 首100字: {text[:100]}")
    if use_cache:
        cache_path = _get_cache_path(text, lang)
        if os.path.exists(cache_path) and os.path.getsize(cache_path) > 100:
            logger.info(f"TTS 缓存命中: {cache_path}")
            return cache_path

    result = None
    if prefer_edge:
        result = await text_to_speech_edge(text)
        if result is None:
            result = await text_to_speech_gtts(text, lang)
    else:
        result = await text_to_speech_gtts(text, lang)
        if result is None:
            result = await text_to_speech_edge(text)

    if result is None:
        logger.error(f"TTS 所有引擎均失败, text={text[:50]}")
        return None

    if ensure_wav:
        wav_path = _convert_to_wav(result)
        if not result.startswith(CACHE_DIR):
            try: os.unlink(result)
            except OSError: pass
        result = wav_path
        if result is None:
            logger.error("TTS 转换WAV失败")
            return None

    if use_cache:
        try:
            cache_path = _get_cache_path(text, lang)
            shutil.copy2(result, cache_path)
            logger.info(f"TTS 写入缓存: {cache_path}")
        except Exception as e:
            logger.warning(f"TTS 缓存写入失败: {e}")

    if use_cache and hash(text) % 10 == 0:
        _cleanup_old_cache()
    return result


async def warmup_tts_cache():
    """服务启动时预合成常用短语到缓存"""
    logger.info(f"TTS 缓存预热开始: {len(WARMUP_PHRASES)} 条短语...")
    warmed = 0
    for phrase in WARMUP_PHRASES:
        cache_path = _get_cache_path(phrase)
        if os.path.exists(cache_path) and os.path.getsize(cache_path) > 100:
            warmed += 1
            continue
        try:
            result = await text_to_speech_edge(phrase)
            if result:
                wav_path = _convert_to_wav(result)
                if wav_path:
                    shutil.copy2(wav_path, cache_path)
                    try: os.unlink(wav_path)
                    except OSError: pass
                    warmed += 1
                if not result.startswith(CACHE_DIR):
                    try: os.unlink(result)
                    except OSError: pass
        except Exception as e:
            logger.warning(f"TTS 预热失败 [{phrase}]: {e}")
    logger.info(f"TTS 缓存预热完成: {warmed}/{len(WARMUP_PHRASES)} 条")


def _convert_to_wav(input_path: str) -> str | None:
    if not input_path or not os.path.exists(input_path):
        return None
    try:
        with wave.open(input_path, 'r') as wf:
            if (wf.getframerate() == 16000 and
                wf.getsampwidth() == 2 and
                wf.getnchannels() == 1):
                return input_path
    except Exception:
        pass
    fd, output_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-ar", "16000",
            "-ac", "1",
            "-sample_fmt", "s16",
            "-f", "wav",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            logger.error(f"ffmpeg 转换失败: {result.stderr[:200]}")
            try: os.unlink(output_path)
            except OSError: pass
            return None
        out_size = os.path.getsize(output_path)
        if out_size < 100:
            logger.error(f"ffmpeg 输出文件太小: {out_size}")
            try: os.unlink(output_path)
            except OSError: pass
            return None
        return output_path
    except FileNotFoundError:
        logger.error("ffmpeg 未安装")
        return None
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg 转换超时")
        return None
    except Exception as e:
        logger.error(f"ffmpeg 转换异常: {e}")
        return None


async def text_to_speech_bytes(
    text: str,
    lang: str = "zh-CN",
    use_cache: bool = True,
    prefer_edge: bool = True,
) -> bytes | None:
    path = await text_to_speech(text, lang, use_cache, prefer_edge)
    if path is None:
        return None
    try:
        with open(path, "rb") as f:
            data = f.read()
        if not path.startswith(CACHE_DIR):
            os.unlink(path)
        return data
    except Exception as e:
        logger.error(f"读取 TTS 文件失败: {e}")
        return None
