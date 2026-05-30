"""灵境硬件语音端点 - 为 ESP32 语音硬件提供一站式语音交互服务 (优化版)

优化点:
  1. faster-whisper 替代 openai-whisper: STT 从 2-5s 降至 0.5-1s
  2. AI max_tokens 降至 150: 回复更短, TTS更快, 适配语音场景
  3. 每阶段超时保护: 单项超时不影响整体
  4. 音频长度自动截断: 超过8s自动截取前8s (硬件语音无需长段)
  5. TTS缓存优先: 高频回复预命中

端点:
  POST /api/v1/hardware/voice
    接受: multipart/form-data (audio_file + token)
    流程: 音频 → faster-whisper STT → AI Chat → TTS → 返回音频
    返回: audio/wav 二进制流 (或 application/json 错误)

延迟预算 (优化后):
  STT(0.3-0.8s) + AI(0.5-1.5s) + TTS(0.5-1.5s) = 1.3-3.8s 端到端
"""
import os
import sys
import logging
import asyncio
import time

from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
import db as database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/hardware", tags=["hardware"])

# ── 配置 ──────────────────────────────────────────────────

_MAX_AUDIO_BYTES = 5 * 1024 * 1024   # 5MB 文件限制
_MAX_AUDIO_DURATION_SEC = 8          # 音频超过8s自动截取前8s (~256KB PCM16)
_AI_TIMEOUT = 15.0                   # AI 调用超时
_AI_MAX_TOKENS = 150                 # 硬件语音回复控制在150token内 (~100字)

# ── AI 对话简化版 ──────────────────────────────────────────

HARDWARE_SYSTEM_PROMPT = """你的名字叫「灵境」，是一个语音对话助手。用户通过语音与你交流，你会听到用户的语音输入。

回复要求：
1. 简洁明了 — 语音场景下用户无法看长文本，每句话控制在50字以内
2. 自然口语化 — 像真人对话一样自然，不要用列表、编号等书面格式
3. 一次只说一个重点 — 语音不适合信息轰炸
4. 不确定就说不知道 — 不编造信息
5. 语气平和真诚 — 像见得世面的老朋友

记住：用户是用听的，不是用看的。回复必须适合语音播报。"""


async def _hardware_ai_chat(user_text: str, user_info: dict | None = None) -> str:
    """简化版 AI 对话 - 支持业务上下文"""
    system_prompt = HARDWARE_SYSTEM_PROMPT
    
    if user_info and user_info.get("tenant_id"):
        company = user_info.get("company_name") or "你的企业"
        tenant_id = user_info["tenant_id"]
        system_prompt += f"\n\n当前用户是{company}的成员。"
        try:
            async with database.pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT name, role FROM tenant_users WHERE tenant_id=$1 ORDER BY created_at",
                    tenant_id,
                )
                if rows:
                    role_names = {
                        "owner": "老板", "admin": "管理员", "project_manager": "项目经理",
                        "worker": "工人", "member": "待分配", "technician": "技术员",
                        "customer": "客户",
                    }
                    members = []
                    for r in rows:
                        role_cn = role_names.get(r["role"], r["role"])
                        members.append(f"{r['name']}（{role_cn}）")
                    if members:
                        system_prompt += f"\n\n{company}的团队成员：" + "、".join(members)
        except Exception:
            logger.warning("查询团队信息失败，跳过", exc_info=True)
    
    messages = [{"role": "system", "content": system_prompt}]
    if user_info:
        nickname = user_info.get("nickname") or user_info.get("code", "用户")
        messages.append({"role": "system", "content": f"当前用户: {nickname}。使用自然口语化的方式称呼即可。"})
    messages.append({"role": "user", "content": user_text})

    headers = {
        "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config.DEEPSEEK_MODEL,
        "messages": messages,
        "max_tokens": _AI_MAX_TOKENS,
        "stream": False,
        "temperature": 0.7,
    }

    try:
        async with httpx.AsyncClient(timeout=_AI_TIMEOUT) as client:
            resp = await client.post(
                f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                headers=headers, json=payload,
            )
            if resp.status_code != 200:
                logger.error(f"AI Chat API 错误: {resp.status_code} {resp.text[:200]}")
                return "抱歉, 我现在有点卡顿, 请稍后再试。"
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            logger.info(f"硬件AI回复 ({len(content)}字): {content[:80]}...")
            return content
    except httpx.TimeoutException:
        logger.error("AI Chat 超时")
        return "抱歉, 我思考太久了, 请再说一遍。"
    except Exception as e:
        logger.error(f"AI Chat 异常: {e}")
        return "抱歉, 出了点小问题, 请稍后再试。"


# ── 音频预处理 ────────────────────────────────────────────

def _truncate_audio_if_needed(audio_bytes: bytes, sample_rate: int = 16000) -> bytes:
    """如果音频超过最大时长，截取前 _MAX_AUDIO_DURATION_SEC 秒"""
    max_bytes = _MAX_AUDIO_DURATION_SEC * sample_rate * 2  # 16bit = 2bytes
    if len(audio_bytes) > max_bytes:
        logger.info(f"音频过长: {len(audio_bytes)} bytes, 截取前{_MAX_AUDIO_DURATION_SEC}s ({max_bytes} bytes)")
        return audio_bytes[:max_bytes]
    return audio_bytes


def _has_voice_activity(audio_bytes: bytes, sample_rate: int = 16000) -> bool:
    """快速检测音频是否有语音（取前1s检测能量）"""
    # 取前1秒的音频做能量检测
    chunk = audio_bytes[:sample_rate * 2]  # 1s PCM16
    if len(chunk) < 160:  # 至少10ms
        return len(audio_bytes) > 1000  # 有足够数据就算有声音
    
    # 计算RMS能量
    import struct
    samples = len(chunk) // 2
    total = 0
    count = 0
    for i in range(0, len(chunk) - 1, 2):
        val = abs(struct.unpack('<h', chunk[i:i+2])[0])
        if val > 500:  # 大于阈值算有能量
            total += val
            count += 1
    
    # 如果超过5%的采样点有明显能量，判定为有语音
    return count > max(10, samples * 0.05)


# ── 主端点 ──────────────────────────────────────────────────

@router.post("/voice")
async def hardware_voice(
    audio: UploadFile = File(...),
    token: str = Form(...),
):
    """硬件语音交互端点 (优化版)

    延迟预期: 1.3-3.8秒 (优化前 2-7s)
    """
    t_start = time.time()

    # 1. 验证 token
    user = await _verify_token(token)
    if user is None:
        return JSONResponse(status_code=401, content={"error": "认证失败, 无效的 token"})

    logger.info(f"硬件语音请求: user={user.get('code','?')}, file={audio.filename}")

    # 2. 读取音频文件
    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) < 100:
            return JSONResponse(status_code=400, content={"error": "音频文件为空或过小"})
        if len(audio_bytes) > _MAX_AUDIO_BYTES:
            return JSONResponse(status_code=400, content={"error": "音频文件过大, 请限制在5MB以内"})
        
        # 截断过长音频
        audio_bytes = _truncate_audio_if_needed(audio_bytes)
    except Exception as e:
        logger.error(f"读取音频失败: {e}")
        return JSONResponse(status_code=400, content={"error": "读取音频失败，请检查音频文件格式"})

    # 3. faster-whisper 转写 (STT) — 主加速点
    try:
        from services.transcribe import transcribe_audio_bytes
        loop = asyncio.get_event_loop()
        stt_text = await asyncio.wait_for(
            loop.run_in_executor(None, transcribe_audio_bytes, audio_bytes,
                                 audio.filename or "recording.wav"),
            timeout=10.0,  # STT超时保护
        )
        if not stt_text or stt_text in ("[语音数据为空，请重新录音]", "[无法识别语音内容]"):
            return JSONResponse(status_code=500, content={"error": "语音转写失败, 无法识别"})
        logger.info(f"[{time.time()-t_start:.1f}s] STT ({len(stt_text)}字): {stt_text[:80]}")
    except asyncio.TimeoutError:
        logger.error("STT 转写超时")
        return JSONResponse(status_code=500, content={"error": "语音转写超时, 请缩短录音"})
    except Exception as e:
        logger.error(f"STT 转写失败: {e}")
        return JSONResponse(status_code=500, content={"error": "语音转写失败，请稍后重试"})

    # 4. AI 对话 — 用更短的 max_tokens 加速
    try:
        ai_reply = await asyncio.wait_for(
            _hardware_ai_chat(stt_text, user),
            timeout=_AI_TIMEOUT,
        )
        logger.info(f"[{time.time()-t_start:.1f}s] AI ({len(ai_reply)}字): {ai_reply[:80]}")
    except asyncio.TimeoutError:
        logger.error("AI 对话超时")
        ai_reply = "抱歉, 我思考太久了, 请再说一遍。"
    except Exception as e:
        logger.error(f"AI 对话失败: {e}")
        ai_reply = "抱歉, 我现在有点忙, 请稍后再试。"

    # 5. TTS 合成
    try:
        from services.tts_service import text_to_speech
        audio_path = await asyncio.wait_for(
            text_to_speech(ai_reply, use_cache=True),
            timeout=8.0,
        )
        if audio_path is None:
            return JSONResponse(content={
                "text": ai_reply,
                "error": "语音合成失败, 仅返回文字",
            })
        logger.info(f"[{time.time()-t_start:.1f}s] TTS 完成")
    except asyncio.TimeoutError:
        logger.error("TTS 合成超时")
        return JSONResponse(content={"text": ai_reply, "error": "语音合成超时"})
    except Exception as e:
        logger.error(f"TTS 合成失败: {e}")
        return JSONResponse(content={"text": ai_reply, "error": f"语音合成失败: {str(e)}"})

    # 6. 读取音频文件并返回
    try:
        with open(audio_path, "rb") as f:
            response_audio = f.read()
        from services.tts_service import CACHE_DIR
        if not audio_path.startswith(CACHE_DIR):
            os.unlink(audio_path)
    except Exception as e:
        logger.error(f"读取TTS结果失败: {e}")
        return JSONResponse(status_code=500, content={"error": "读取语音结果失败"})

    elapsed = time.time() - t_start
    logger.info(f"[硬件语音] ✅ 总耗时: {elapsed:.1f}s | "
                f"音频: {len(response_audio)} bytes | "
                f"STT: {stt_text[:30]}... | AI: {ai_reply[:30]}...")

    return Response(
        content=response_audio,
        media_type="audio/wav",
        headers={"X-LingJing-Elapsed": f"{elapsed:.1f}s"},
    )


@router.get("/voice/ping")
async def hardware_ping():
    return {"status": "ok", "servertime": time.time(), "version": "1.0"}


# ── Token 验证 ──────────────────────────────────────────────

async def _verify_token(token: str) -> dict | None:
    if not token or not token.strip():
        return None
    try:
        async with database.pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT u.username as code, u.nickname, u.username,
                          tu.tenant_id, t.company_name,
                          tu.role as tenant_role, t.industry
                   FROM users u
                   LEFT JOIN tenant_users tu ON tu.user_id = u.username
                   LEFT JOIN tenants t ON t.tenant_id = tu.tenant_id
                   WHERE u.token = $1""",
                token,
            )
            if row:
                return dict(row)
            row = await conn.fetchrow(
                """SELECT ic.code, ic.nickname, ic.tenant_id, t.company_name,
                          tu.role as tenant_role, t.industry
                   FROM invite_codes ic
                   LEFT JOIN tenant_users tu ON tu.user_id = ic.code
                   LEFT JOIN tenants t ON t.tenant_id = ic.tenant_id
                   WHERE ic.token = $1""",
                token,
            )
            if row:
                return dict(row)
            return None
    except Exception as e:
        logger.error(f"Token验证失败: {e}")
        return None
