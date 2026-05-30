"""灵境硬件语音端点 - 为 ESP32 语音硬件提供一站式语音交互服务

端点:
  POST /api/v1/hardware/voice
    接受: multipart/form-data (audio_file + token)
    流程: 音频 → Whisper STT → AI Chat → TTS → 返回音频
    返回: audio/wav 二进制流 (或 application/json 错误)

工作流:
  ESP32 按键录音 → HTTP POST → 服务器:
    1. 验证 token → 获取用户信息
    2. Whisper 转写音频为文字
    3. 简化版 AI 对话 (无需 session, 无业务上下文)
    4. TTS 合成 AI 回复为语音
    5. 返回 WAV 音频文件

延迟预算:
  STT(0.5-2s) + AI(1-3s) + TTS(0.5-2s) = 2-7s 端到端
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
    """简化版 AI 对话 - 支持业务上下文（如果用户绑定了企业）"""
    system_prompt = HARDWARE_SYSTEM_PROMPT
    
    # 如果用户有企业租户，注入业务数据上下文
    if user_info and user_info.get("tenant_id"):
        company = user_info.get("company_name") or "你的企业"
        tenant_id = user_info["tenant_id"]
        system_prompt += f"\n\n当前用户是{company}的成员。"
        
        # 查询团队成员信息注入到上下文（让AI能回答"公司有哪些项目经理"类问题）
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
                        team_text = "、".join(members)
                        system_prompt += f"\n\n{company}的团队成员：{team_text}"
        except Exception:
            logger.warning("查询团队信息失败，跳过", exc_info=True)
            pass  # 查询失败不影响主流程
    
    messages = [{"role": "system", "content": system_prompt}]

    # 加入用户身份信息 (如果有)
    if user_info:
        nickname = user_info.get("nickname") or user_info.get("code", "用户")
        messages.append({
            "role": "system",
            "content": f"当前用户: {nickname}。使用自然口语化的方式称呼即可。"
        })

    messages.append({"role": "user", "content": user_text})

    # 使用 DeepSeek API
    api_key = config.DEEPSEEK_API_KEY
    base_url = config.DEEPSEEK_BASE_URL
    model = config.DEEPSEEK_MODEL

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 500,  # 语音回复不需要太长
        "stream": False,
        "temperature": 0.7,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
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


# ── 主端点 ──────────────────────────────────────────────────

@router.post("/voice")
async def hardware_voice(
    audio: UploadFile = File(...,
        description="音频文件 (WAV/MP3/OGG, 推荐16kHz 16bit PCM WAV, 最大5MB)"),
    token: str = Form(...,
        description="用户认证 token (与APP登录token相同)"),
):
    """硬件语音交互端点

    接收 ESP32 硬件上传的音频, 返回 AI 回复的语音音频。

    请求:
        multipart/form-data
        - audio: 音频文件 (必填, ≤5MB, 支持 WAV/MP3/OGG)
        - token: 用户认证 token (必填)

    返回:
        - 成功: audio/wav 二进制流 (可直接播放)
        - 失败: application/json {"error": "..."}

    延迟预期: 2-7秒 (取决于音频长度 + AI响应速度)
    """
    t_start = time.time()

    # 1. 验证 token
    user = await _verify_token(token)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={"error": "认证失败, 无效的 token"},
        )

    logger.info(f"硬件语音请求: user={user.get('code','?')}, "
                f"filename={audio.filename}, "
                f"content_type={audio.content_type}")

    # 2. 读取音频文件
    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) < 100:
            return JSONResponse(
                status_code=400,
                content={"error": "音频文件为空或过小"},
            )
        if len(audio_bytes) > 5 * 1024 * 1024:
            return JSONResponse(
                status_code=400,
                content={"error": "音频文件过大, 请限制在5MB以内"},
            )
    except Exception as e:
        logger.error(f"读取音频失败: {e}")
        return JSONResponse(status_code=400, content={"error": f"读取音频失败: {str(e)}"})

    # 3. Whisper 转写 (STT)
    try:
        from services.transcribe import transcribe_audio_bytes
        loop = asyncio.get_event_loop()
        stt_text = await loop.run_in_executor(
            None, transcribe_audio_bytes, audio_bytes,
            audio.filename or "recording.wav"
        )
        if not stt_text:
            return JSONResponse(status_code=500, content={"error": "语音转写失败, 无法识别"})
        logger.info(f"[{t_start:.1f}] STT 结果 ({len(stt_text)}字): {stt_text[:100]}")
    except Exception as e:
        logger.error(f"STT 转写失败: {e}")
        return JSONResponse(status_code=500, content={"error": f"语音转写失败: {str(e)}"})

    # 4. AI 对话
    try:
        ai_reply = await _hardware_ai_chat(stt_text, user)
        logger.info(f"[{time.time()-t_start:.1f}s] AI 回复 ({len(ai_reply)}字) 前200字: {ai_reply[:200]}")
    except Exception as e:
        logger.error(f"AI 对话失败: {e}")
        ai_reply = "抱歉, 我现在有点忙, 请稍后再试。"

    # 5. TTS 合成
    try:
        from services.tts_service import text_to_speech
        audio_path = await text_to_speech(ai_reply, use_cache=True)
        if audio_path is None:
            # TTS 失败, 返回文字让硬件显示
            return JSONResponse(content={
                "text": ai_reply,
                "error": "语音合成失败, 仅返回文字",
            })
        logger.info(f"[{time.time()-t_start:.1f}s] TTS 合成完成")
    except Exception as e:
        logger.error(f"TTS 合成失败: {e}")
        return JSONResponse(content={
            "text": ai_reply,
            "error": f"语音合成失败: {str(e)}",
        })

    # 6. 读取音频文件并返回（TTS已转为标准WAV: 16kHz/16bit/mono）
    try:
        with open(audio_path, "rb") as f:
            response_audio = f.read()
        # 清理非缓存临时文件
        from services.tts_service import CACHE_DIR
        if not audio_path.startswith(CACHE_DIR):
            os.unlink(audio_path)
    except Exception as e:
        logger.error(f"读取TTS结果失败: {e}")
        return JSONResponse(status_code=500, content={"error": "读取语音结果失败"})

    elapsed = time.time() - t_start
    logger.info(f"[硬件语音] 总耗时: {elapsed:.1f}s | "
                f"STT: {stt_text[:50]}... | "
                f"AI: {ai_reply[:50]}... | "
                f"音频: {len(response_audio)} bytes")

    return Response(
        content=response_audio,
        media_type="audio/wav",
        headers={
            "X-LingJing-Elapsed": f"{elapsed:.1f}s",
        },
    )


@router.get("/voice/ping")
async def hardware_ping():
    """硬件心跳检测 - ESP32 定期调用检查网络和服务器状态"""
    return {"status": "ok", "servertime": time.time(), "version": "1.0"}


# ── Token 验证 ──────────────────────────────────────────────

async def _verify_token(token: str) -> dict | None:
    """验证硬件请求的 token, 返回用户信息"""
    if not token or not token.strip():
        return None

    try:
        async with database.pool.acquire() as conn:
            # 注册用户 token 验证
            # users.username 关联 tenant_users.user_id
            # tenants.tenant_id 是 varchar 主键
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

            # 邀请码用户 token 验证 (旧版兼容)
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
