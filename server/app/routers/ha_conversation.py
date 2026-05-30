"""灵境 - Home Assistant Conversation API 兼容层

为 小智(ESP32-S3-BOX-3) 等硬件提供标准 Home Assistant Conversation API 端点。

端点:
  POST /api/v1/ha/conversation/process
    Authorization: Bearer <api_key>
    Body: { "text": "...", "conversation_id": "...", "language": "zh-CN" }
    Response: { "response": { "speech": { "plain": { "speech": "..." } } }, "conversation_id": "..." }

工作流:
  1. 验证 API Key → 获取绑定信息（租户等）
  2. 查找/创建 conversation (映射到 chat_sessions)
  3. 调用 AI 对话（简化版，无需业务上下文）
  4. 存储对话记录
  5. 返回 HA 兼容格式

小智配置:
  在 小智 后台选择「Home Assistant」对话代理
  填入: https://你的域名/api/v1/ha/conversation/process
  Authorization: Bearer <从超管后台生成的API Key>
"""
import logging
import uuid
import os
import sys

from fastapi import APIRouter, Header, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Optional
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
import db as database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ha", tags=["ha_conversation"])

# ── System Prompt ──

HA_SYSTEM_PROMPT = """你的名字叫「灵境」，是一个智能对话助手。

回复要求：
1. 简洁明了 — 回复控制在100字以内，适合语音播报
2. 自然口语化 — 像真人对话一样自然
3. 一次只说一个重点
4. 不确定就说不知道，不编造信息
5. 语气平和真诚

记住：用户是通过语音设备与你交流，回复必须适合语音播报。"""

# ── 鉴权 ──

async def verify_api_key(authorization: str = Header(None)) -> dict:
    """验证 API Key，返回 key 信息"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少 Authorization header，格式: Bearer <api_key>")
    
    api_key = authorization[7:].strip()
    if not api_key:
        raise HTTPException(status_code=401, detail="API Key 不能为空")
    
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, api_key, name, tenant_id, status FROM api_keys WHERE api_key=$1",
            api_key,
        )
    
    if not row:
        raise HTTPException(status_code=401, detail="API Key 无效")
    
    if row["status"] != "active":
        raise HTTPException(status_code=403, detail="API Key 已被禁用")
    
    # 更新最后使用时间
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE api_keys SET last_used_at=NOW() WHERE id=$1",
            row["id"],
        )
    
    return {
        "key_id": row["id"],
        "api_key": row["api_key"],
        "name": row["name"],
        "tenant_id": row["tenant_id"],
    }


# ── 请求/响应模型 ──

class HAConversationRequest:
    """Home Assistant Conversation API 请求格式"""
    def __init__(self, text: str, conversation_id: Optional[str] = None, language: str = "zh-CN"):
        self.text = text
        self.conversation_id = conversation_id
        self.language = language or "zh-CN"


# ── 核心端点 ──

@router.post("/conversation/process", response_class=JSONResponse)
async def ha_conversation_process(
    request: dict,
    key_info: dict = Depends(verify_api_key),
):
    """Home Assistant Conversation API 端点
    
    输入 (JSON Body):
      { "text": "你好", "conversation_id": null, "language": "zh-CN" }
    
    输出 (JSON):
      { "response": { "speech": { "plain": { "speech": "你好！我是灵境，有什么可以帮你的？" } } }, "conversation_id": "..." }
    """
    text = request.get("text", "").strip()
    if not text:
        return _ha_response("请说点什么吧", None)
    
    conversation_id = request.get("conversation_id")
    tenant_id = key_info.get("tenant_id")
    
    try:
        # 1. 映射会话: conversation_id → session_id
        session_id = None
        if conversation_id:
            async with database.pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT session_id FROM chat_sessions WHERE session_id=$1",
                    conversation_id,
                )
                if row:
                    session_id = row["session_id"]
        
        # 如果没有会话或会话不存在，创建新的
        if not session_id:
            session_id = f"ha_{uuid.uuid4().hex[:16]}"
            title = text[:20]
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO chat_sessions (session_id, invite_code, title, tenant_id)
                       VALUES ($1, $2, $3, $4)""",
                    session_id, f"ha_{key_info['api_key'][:8]}", title, tenant_id,
                )
        
        # 2. 存储用户消息
        async with database.pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO chat_messages (session_id, role, content)
                   VALUES ($1, 'user', $2)""",
                session_id, text,
            )
        
        # 3. 调用 AI
        reply = await _ha_ai_chat(text, tenant_id=tenant_id, session_id=session_id)
        
        # 4. 存储 AI 回复
        async with database.pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO chat_messages (session_id, role, content)
                   VALUES ($1, 'assistant', $2)""",
                session_id, reply,
            )
            # 更新会话
            await conn.execute(
                """UPDATE chat_sessions
                   SET message_count = message_count + 2,
                       updated_at = NOW()
                   WHERE session_id = $1""",
                session_id,
            )
        
        # 5. 返回 HA 格式
        return _ha_response(reply, session_id)
        
    except Exception as e:
        logger.error(f"HA Conversation 异常: {e}", exc_info=True)
        return _ha_error("处理请求时出现内部错误", conversation_id)


async def _ha_ai_chat(user_text: str, tenant_id: str = None, session_id: str = None) -> str:
    """调用 AI 对话（简化版）"""
    system_prompt = HA_SYSTEM_PROMPT
    
    # 如果有租户，注入企业上下文
    if tenant_id:
        try:
            async with database.pool.acquire() as conn:
                tenant = await conn.fetchrow(
                    "SELECT company_name FROM tenants WHERE tenant_id=$1",
                    tenant_id,
                )
                if tenant and tenant["company_name"]:
                    company = tenant["company_name"]
                    system_prompt += f"\n\n当前用户是{company}的成员。你可以回答关于{company}的问题。"
                    
                    # 团队成员信息
                    rows = await conn.fetch(
                        "SELECT name, role FROM tenant_users WHERE tenant_id=$1 ORDER BY created_at",
                        tenant_id,
                    )
                    if rows:
                        role_names = {
                            "owner": "老板", "admin": "管理员", "project_manager": "项目经理",
                            "worker": "工人", "member": "成员", "technician": "技术员",
                        }
                        members = []
                        for r in rows:
                            role_cn = role_names.get(r["role"], r["role"])
                            members.append(f"{r['name']}（{role_cn}）")
                        if members:
                            system_prompt += f"\n\n{company}的团队成员：{'、'.join(members)}"
        except Exception:
            logger.warning("查询业务上下文失败", exc_info=True)
    
    messages = [{"role": "system", "content": system_prompt}]
    
    # 注入最近几条对话历史（支持多轮）
    try:
        async with database.pool.acquire() as conn:
            history = await conn.fetch(
                """SELECT role, content FROM chat_messages
                   WHERE session_id=$1 AND role IN ('user', 'assistant')
                   ORDER BY created_at DESC LIMIT 6""",
                session_id,
            )
            if history:
                # 反转顺序: 从最早到最新
                for h in reversed(history):
                    messages.append({
                        "role": h["role"],
                        "content": h["content"],
                    })
    except Exception:
        pass
    
    # 确保最后一条是当前用户消息
    if messages[-1]["role"] != "user":
        messages.append({"role": "user", "content": user_text})
    
    # 调用 AI（优先 DeepSeek，回退 Ollama）
    try:
        # 尝试 DeepSeek API
        if config.DEEPSEEK_API_KEY:
            headers = {
                "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": config.DEEPSEEK_MODEL,
                "messages": messages,
                "max_tokens": 500,
                "stream": False,
                "temperature": 0.7,
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    logger.info(f"HA AI回复 ({len(content)}字)")
                    return content
                else:
                    logger.warning(f"DeepSeek API 错误: {resp.status_code}, 回退 Ollama")
    except Exception as e:
        logger.warning(f"DeepSeek 调用失败 ({e}), 回退 Ollama")
    
    # 回退: Ollama
    try:
        payload = {
            "model": config.OLLAMA_CHAT_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"num_predict": 500},
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{config.OLLAMA_CHAT_URL}/api/chat",
                json=payload,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["message"]["content"].strip()
    except Exception as e:
        logger.error(f"Ollama 也失败: {e}")
    
    return "抱歉，我现在无法回答，请稍后再试。"


def _ha_response(speech_text: str, conversation_id: str = None) -> dict:
    """构造 HA 兼容的成功响应"""
    resp = {
        "response": {
            "response_type": "action_done",
            "speech": {
                "plain": {
                    "speech": speech_text,
                }
            },
            "data": {
                "targets": [],
                "success": [],
                "failed": [],
            },
        },
    }
    if conversation_id:
        resp["conversation_id"] = conversation_id
    return resp


def _ha_error(error_text: str, conversation_id: str = None) -> dict:
    """构造 HA 兼容的错误响应"""
    resp = {
        "response": {
            "response_type": "error",
            "speech": {
                "plain": {
                    "speech": error_text,
                }
            },
            "data": {
                "code": "failed_to_handle",
            },
        },
    }
    if conversation_id:
        resp["conversation_id"] = conversation_id
    return resp


# ── Health Check ──

@router.get("/ping")
async def ha_ping():
    """健康检查端点"""
    return {"status": "ok", "service": "灵境 HA Conversation API"}
