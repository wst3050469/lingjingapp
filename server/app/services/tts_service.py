"""语音合成服务 (TTS) - 支持 Edge TTS / gTTS 双引擎

架构:
  text_to_speech(text, lang='zh-CN')
    ├── 检查缓存 → 命中直接返回路径
    ├── Edge TTS (主引擎, 微软免费接口, 中文效果最佳)
    │     └── 失败降级 → gTTS (备选, Google 免费)
    └── 返回 WAV 文件路径

缓存: 以文本哈希为key, 重复文本直接返回缓存文件 (有效期24h)
"""
import os
import hashlib
import logging
import tempfile
import time
import shutil
import wave
import subprocess

logger = logging.getLogger(__name__)

# TTS 缓存目录
CACHE_DIR = os.environ.get(
    "TTS_CACHE_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "tts_cache")
)
os.makedirs(CACHE_DIR, exist_ok=True)

# 中文语音角色
EDGE_VOICE_MAP = {
    "zh-CN": "zh-CN-XiaoxiaoNeural",
    "zh-CN-Yunxi": "zh-CN-YunxiNeural",
    "zh-CN-Xiaoyi": "zh-CN-XiaoyiNeural",
}
DEFAULT_EDGE_VOICE = "zh-CN-XiaoxiaoNeural"
MAX_TEXT_LENGTH = 500


def _escape_xml(text: str) -> str:
    """转义XML/SSML特殊字符，避免Edge TTS解析失败导致跳过部分文本
    
    Edge TTS内部使用SSML包装文本，& < > 等字符会破坏XML结构。
    例如公司名「A&B建筑」中的&会导致引擎解析失败跳过该词。
    """
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    text = text.replace("'", "&apos;")
    return text


def _clean_text(text: str) -> str:
    """清理文本中的Markdown标记和特殊符号，只保留纯文字用于TTS播报
    
    移除：
    - Markdown粗体/斜体标记：**text** __text__ *text* _text_
    - 特殊括号：『』「」【】〔〕
    - 货币符号：$ € £ ¥
    - 其他特殊符号：# @ ^ ~ | \\ { } [ ] < >
    - Markdown标题：# 开头
    - Markdown链接：[text](url)
    - Markdown图片：![alt](url)
    - 裸URL：https://...
    - 表情符号(emoji)
    - 无序列表标记：- * +
    - 分隔线：---
    
    保留：
    - 中文标点：。！？，、；：《》（）
    - 引号"" ''（不会被Edge TTS特殊处理）
    """
    import re
    original = text  # 保留原始副本用于诊断日志
    
    # 移除Markdown标题符号
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    
    # 移除粗体/斜体符号（先处理**再处理*，避免冲突）
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'__(.+?)__', r'\1', text)
    text = re.sub(r'_(.+?)_', r'\1', text)
    # 安全清理：移除残留的独立*符号
    text = text.replace('*', '')
    
    # 移除代码块
    text = re.sub(r'```[\s\S]*?```', '[代码]', text)
    text = re.sub(r'`(.+?)`', r'\1', text)
    
    # 移除Markdown链接和图片
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    
    # 移除裸URL
    text = re.sub(r'https?://\S+', '', text)
    
    # 移除分隔线
    text = re.sub(r'^---+', '', text, flags=re.MULTILINE)
    
    # 移除引用符号
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
    
    # 移除无序列表符号
    text = re.sub(r'^[\s]*[-*+]\s+', '', text, flags=re.MULTILINE)
    
    # 移除特殊括号（不读出来，但保留内容）
    for ch in ['「', '」', '『', '』', '【', '】', '〔', '〕']:
        text = text.replace(ch, '')
    
    # 当"灵境"后跟公司名称后缀时，只保留"灵境"本身
    # 匹配模式：灵境 + (可选括号内容如"（北京）") + 常见公司后缀词
    text = re.sub(
        r'灵境\s*(?:[（(][^）)]*[）)])?\s*(?:科技|信息|技术|网络|软件|数据|智能|数字|文化|传媒|教育|咨询|管理|服务|实业|发展|投资|控股|股份|集团|有限|责任|总公司|分公司|公司)+',
        '灵境',
        text
    )
    
    # 移除货币符号
    for ch in ['$', '€', '£', '¥']:
        text = text.replace(ch, '')
    
    # 移除其他特殊符号
    for ch in ['@', '#', '^', '~', '|', '\\', '{', '}', '<', '>']:
        text = text.replace(ch, '')
    
    # 间隔号/中圆点 -> 空格（TTS引擎无法处理，否则跳过整段）
    text = text.replace(chr(183), ' ')
    text = text.replace(chr(8226), ' ')
    
    # & 转为 和（保留语义）
    text = text.replace('&', chr(21644))
    
    # 移除多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    result = text.strip()
    
    # 诊断日志：记录清理前后变化，便于排查TTS跳过问题
    if result != original.strip():
        removed_chars = len(original) - len(result)
        logger.info(
            f"TTS _clean_text: {len(original)}字 → {len(result)}字 "
            f"(移除{removed_chars}字, {removed_chars/len(original)*100:.1f}%)"
        )
        # 记录前100字变化
        for i in range(min(len(original), 100)):
            if i >= len(result) or original[i] != result[i]:
                logger.info(f"TTS 差异位置 {i}: '{original[max(0,i-5):i+10]}' → '{result[max(0,i-5):min(len(result),i+10)]}'")
                break
    
    return result



def _smart_truncate(text: str, max_len: int = MAX_TEXT_LENGTH) -> str:
    """智能截断：在句尾边界截断，避免在名字/单词中间截断
    
    优先按句号/问号/感叹号/换行截断，找不到再按逗号/分号，
    最后才硬截断。
    """
    if len(text) <= max_len:
        return text
    # 先找句尾边界：。！？\n
    for sep in ("。", "！", "？", "\n", "；", "，"):
        idx = text.rfind(sep, 0, max_len)
        if idx > max_len * 0.5:  # 至少保留一半内容
            return text[:idx + 1]
    # 找不到合适的标点，硬截断
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
        # Edge TTS 使用SSML包装文本，需转义XML特殊字符避免解析失败
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
            try:
                os.unlink(tmp_path)
            except OSError as e:
                logger.warning(f"Edge TTS 清理临时文件失败 [{tmp_path}]: {e}")
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
            try:
                os.unlink(tmp_path)
            except OSError as e:
                logger.warning(f"gTTS 清理临时文件失败 [{tmp_path}]: {e}")
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
    # 清理Markdown标记和特殊符号（在截断和缓存之前）
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
        logger.info(f"TTS 文本已截断: {text_before}字 → {len(text)}字 (智能截断)")
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
            try:
                os.unlink(result)
            except OSError as e:
                logger.warning(f"TTS 清理旧格式文件失败 [{result}]: {e}")
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


def _convert_to_wav(input_path: str) -> str | None:
    if not input_path or not os.path.exists(input_path):
        return None
    try:
        with wave.open(input_path, 'r') as wf:
            if (wf.getframerate() == 16000 and
                wf.getsampwidth() == 2 and
                wf.getnchannels() == 1):
                logger.info(f"已经是标准WAV: {input_path}")
                return input_path
    except Exception:
        logger.warning("WAV格式检测失败，尝试转换", exc_info=True)
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
            except OSError as e:
                logger.warning(f"清理失败输出文件失败: {e}")
            return None
        out_size = os.path.getsize(output_path)
        if out_size < 100:
            logger.error(f"ffmpeg 输出文件太小: {out_size}")
            try: os.unlink(output_path)
            except OSError as e:
                logger.warning(f"清理无效输出文件失败: {e}")
            return None
        logger.info(f"ffmpeg WAV转换成功: {out_size} bytes")
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
