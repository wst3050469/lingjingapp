"""
灵境语音通话服务 - VAD检测 + 语音管道 + 中断支持 (优化版)

优化点:
  1. 使用 faster-whisper 加速 STT (通过 transcribe.py 自动生效)
  2. AI max_tokens 降至 200, 回复更短适配语音
  3. AI 超时 10s, TTS 超时 8s

状态机: IDLE → LISTENING → THINKING → SPEAKING → (打断) → LISTENING
"""
import os, sys, io, wave, asyncio, logging
from enum import Enum
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logger = logging.getLogger("lingjing.voice_call")

class CallState(Enum):
    IDLE = "idle"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"

class VoiceCallSession:
    def __init__(self, user_code: str, tenant_id: str = None, user_name: str = ""):
        self.user_code = user_code
        self.tenant_id = tenant_id
        self.user_name = user_name
        self.state = CallState.IDLE
        self.audio_buffer = bytearray()
        self.vad = None
        self.sample_rate = 16000
        self.silence_frames = 0
        self.speech_frames = 0
        self.SILENCE_THRESHOLD = 15
        self.SPEECH_THRESHOLD = 3
        self.interrupted = False
        self._init_vad()

    def _init_vad(self):
        try:
            import webrtcvad
            self.vad = webrtcvad.Vad(2)
            logger.info("VAD初始化成功")
        except Exception as e:
            logger.warning(f"VAD初始化失败: {e}")

    def is_speech(self, pcm_chunk: bytes) -> bool:
        if not self.vad or len(pcm_chunk) < 320:
            return len(pcm_chunk) > 100
        try:
            return self.vad.is_speech(pcm_chunk[:320], self.sample_rate)
        except Exception:
            return True

    async def process_audio_chunk(self, chunk: bytes) -> dict | None:
        if not chunk:
            return None
        self.audio_buffer.extend(chunk)
        if self.is_speech(chunk):
            self.speech_frames += 1
            self.silence_frames = 0
        else:
            self.silence_frames += 1
            self.speech_frames = 0
        if self.state == CallState.IDLE and self.speech_frames >= self.SPEECH_THRESHOLD:
            self.state = CallState.LISTENING
            self.audio_buffer = bytearray(chunk)
            self.speech_frames = 0
            return {"type": "state", "state": "listening"}
        if self.state == CallState.SPEAKING and self.speech_frames >= self.SPEECH_THRESHOLD:
            self.interrupted = True
            self.state = CallState.LISTENING
            self.audio_buffer = bytearray(chunk)
            self.speech_frames = 0
            self.silence_frames = 0
            logger.info("用户打断!")
            return {"type": "interrupt", "state": "listening"}
        if self.state == CallState.LISTENING and self.silence_frames >= self.SILENCE_THRESHOLD:
            if len(self.audio_buffer) < 1600:
                self.state = CallState.IDLE
                self.audio_buffer = bytearray()
                return None
            self.state = CallState.THINKING
            return {"type": "thinking"}
        return None

    async def process_utterance(self) -> bytes | None:
        if len(self.audio_buffer) < 1600:
            return None
        try:
            wav_data = self._pcm_to_wav(bytes(self.audio_buffer))
            text = await self._transcribe(wav_data)
            if not text or len(text.strip()) < 1:
                self.state = CallState.IDLE
                return None
            if self.interrupted:
                self.interrupted = False
                self.state = CallState.LISTENING
                return None
            reply = await self._ai_chat(text)
            if not reply:
                self.state = CallState.IDLE
                return None
            if self.interrupted:
                self.interrupted = False
                self.state = CallState.LISTENING
                return None
            audio = await self._tts(reply)
            self.state = CallState.SPEAKING
            return audio
        except Exception as e:
            logger.error(f"处理语句失败: {e}")
            self.state = CallState.IDLE
            return None

    def _pcm_to_wav(self, pcm: bytes) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(pcm)
        return buf.getvalue()

    async def _transcribe(self, wav_data: bytes) -> str:
        try:
            from services.transcribe import transcribe_audio_bytes
            text = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, lambda: transcribe_audio_bytes(wav_data)),
                timeout=8.0)
            return (text or "").strip()
        except asyncio.TimeoutError:
            logger.warning("转写超时")
            return ""
        except Exception as e:
            logger.warning(f"转写失败: {e}")
            return ""

    async def _ai_chat(self, text: str) -> str:
        try:
            from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
            import httpx
            system = f"你是灵境，{self.user_name or '用户'}的AI伙伴。回复简洁口语化，就像在打电话聊天。控制在80字内。"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{DEEPSEEK_BASE_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
                    json={"model": DEEPSEEK_MODEL, "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": text}],
                        "max_tokens": 200, "temperature": 0.7})
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning(f"AI失败: {e}")
            return ""

    async def _tts(self, text: str) -> bytes | None:
        try:
            from services.tts_service import text_to_speech
            wav_path = await asyncio.wait_for(
                text_to_speech(text), timeout=8.0)
            if wav_path and os.path.exists(wav_path):
                with open(wav_path, 'rb') as f:
                    return f.read()
        except asyncio.TimeoutError:
            logger.warning("TTS超时")
        except Exception as e:
            logger.warning(f"TTS失败: {e}")
        return None

_sessions: dict[str, VoiceCallSession] = {}

def get_or_create_session(user_code: str, tenant_id: str = None, name: str = "") -> VoiceCallSession:
    if user_code not in _sessions:
        _sessions[user_code] = VoiceCallSession(user_code, tenant_id, name)
    return _sessions[user_code]

def remove_session(user_code: str):
    _sessions.pop(user_code, None)
