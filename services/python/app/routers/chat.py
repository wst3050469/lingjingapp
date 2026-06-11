"""灵境平台 - 聊天路由 (SSE流式)"""
import asyncio
import json
import re
import uuid
import logging
import traceback
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from .auth import get_current_user
from services import ai_chat, context_builder
from services.personal_report_service import retrieve_latest_report
from services.biz_query import get_business_context
from services.biz_actions import execute_business_actions
from services.biz_flow import get_flow_summary
from services.memory_extractor import extract_and_store
from services.file_service import get_file_contexts, wait_for_processing
from services.attendance_approval import evaluate_checkin
from services.transcribe import transcribe_base64

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class SendMessage(BaseModel):
    session_id: str
    content: str
    file_ids: list[str] = []


class CreateSession(BaseModel):
    title: str = "新对话"


@router.post("/sessions")
async def create_session(req: CreateSession, user: dict = Depends(get_current_user)):
    session_id = f"s_{uuid.uuid4().hex[:16]}"
    tenant_id = user.get("tenant_id")
    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO chat_sessions (session_id, invite_code, title, tenant_id)
               VALUES ($1, $2, $3, $4)""",
            session_id, user["code"], req.title, tenant_id,
        )
    return {"code": 0, "session_id": session_id, "title": req.title}


@router.get("/sessions")
async def list_sessions(user: dict = Depends(get_current_user)):
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT session_id, title, message_count, created_at, updated_at
               FROM chat_sessions
               WHERE invite_code=$1
               ORDER BY updated_at DESC
               LIMIT 100""",
            user["code"],
        )
    data = [
        {
            "session_id": r["session_id"],
            "title": r["title"],
            "message_count": r["message_count"],
            "created_at": r["created_at"].isoformat(),
            "updated_at": r["updated_at"].isoformat(),
        }
        for r in rows
    ]
    return {"code": 0, "data": data}


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    limit: int = Query(50, le=200),
    offset: int = 0,
    user: dict = Depends(get_current_user),
):
    async with database.pool.acquire() as conn:
        # 验证会话归属
        owner = await conn.fetchval(
            "SELECT invite_code FROM chat_sessions WHERE session_id=$1",
            session_id,
        )
        if owner != user["code"]:
            return {"code": -1, "msg": "无权访问此会话"}

        rows = await conn.fetch(
            """SELECT role, content, model_used, attachments, created_at
               FROM chat_messages
               WHERE session_id=$1
               ORDER BY created_at ASC
               LIMIT $2 OFFSET $3""",
            session_id, limit, offset,
        )
    data = []
    for r in rows:
        att = json.loads(r["attachments"]) if r["attachments"] else None
        # 将 OSS 文件 URL 转为 CDN URL
        if att:
            try:
                from services.oss_service import get_cdn_url
                for a in att:
                    stored = a.get("url", "")
                    if stored and not stored.startswith("http"):
                        a["url"] = get_cdn_url(stored) if stored.startswith("uploads/") else stored
            except Exception:
                logging.getLogger("lingjing.chat").warning("CDN URL转换失败", exc_info=True)
        data.append({
            "role": r["role"],
            "content": r["content"],
            "attachments": att,
            "created_at": r["created_at"].isoformat(),
        })
    return {"code": 0, "data": data}


@router.post("/send")
async def send_message(
    req: SendMessage,
    user: dict = Depends(get_current_user),
    model: str | None = Query(None, description="模型选择: ollama / deepseek / 具体模型名"),
):
    # 验证会话归属
    async with database.pool.acquire() as conn:
        owner = await conn.fetchval(
            "SELECT invite_code FROM chat_sessions WHERE session_id=$1",
            req.session_id,
        )
    if not owner or owner != user["code"]:
        return {"code": -1, "msg": "无权访问此会话"}

    # 处理文件附件
    file_contexts = []
    attachments_json = None
    if req.file_ids:
        await wait_for_processing(req.file_ids, timeout=30)
        file_contexts = await get_file_contexts(req.file_ids)
        attachments_json = json.dumps([{
            "file_id": fc["file_id"],
            "type": fc["type"],
            "name": fc["name"],
            "size": fc["size"],
            "url": fc["url"],
            "thumbnail_url": fc.get("thumbnail_url"),
        } for fc in file_contexts], ensure_ascii=False)

    # 存储用户消息
    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO chat_messages (session_id, role, content, attachments)
               VALUES ($1, 'user', $2, $3)""",
            req.session_id, req.content, attachments_json,
        )

    # 检索记忆 + 获取对话历史 + 业务数据 + 执行业务动作 + 流程提醒
    # 每个操作加超时保护，防止某一项卡住导致整个请求失败
    invite_code = user["code"]
    tenant_id = user.get("tenant_id")
    industry = user.get("industry") or ""
    tenant_role = user.get("tenant_role") or ""
    username = invite_code.replace("u_", "") if invite_code.startswith("u_") else ""

    async def _safe(name, coro):
        if coro is None:
            return None
        try:
            return await asyncio.wait_for(coro, timeout=20.0)
        except asyncio.TimeoutError:
            logging.getLogger("lingjing.chat").warning(f"预处理超时(20s): {name}")
            return None
        except Exception as e:
            logging.getLogger("lingjing.chat").warning(f"预处理失败: {name}: {e}")
            return None

    async def _get_todos_safe(tenant_id: str) -> list[str]:
        try:
            from services.todo_service import get_welcome_todos
            return await get_welcome_todos(tenant_id, user_role=tenant_role)
        except Exception:
            logging.getLogger("lingjing.chat").warning(f"get_welcome_todos失败: tenant={tenant_id}", exc_info=True)
            return []

    memories = await _safe("retrieve_memories",
        context_builder.retrieve_memories(req.content, limit=15, invite_code=invite_code, 
                                          tenant_id=tenant_id, user_role=tenant_role))
    if memories is None:
        memories = []
    chat_history = await _safe("chat_history",
        context_builder.get_chat_history(req.session_id))
    if chat_history is None:
        chat_history = []
    
    # 跨会话关键记忆唤起（新会话或对话短暂时主动注入近期高优先级记忆）
    cross_session_memories = None
    if len(chat_history) < 4:
        cross_session_memories = await _safe("cross_session_memories",
            context_builder.retrieve_recent_key_memories(
                invite_code=invite_code, tenant_id=tenant_id,
                current_session_id=req.session_id, limit=3))
    if cross_session_memories is None:
        cross_session_memories = []
    
    # 个人成长报告：新会话时获取最新周报
    weekly_report = None
    if len(chat_history) < 4:
        weekly_report = await _safe("weekly_report",
            retrieve_latest_report(invite_code=invite_code, tenant_id=tenant_id))
    
    business_context = await _safe("business_context",
        get_business_context(req.content, tenant_id=tenant_id, user=user))
    action_result = await _safe("business_actions",
        execute_business_actions(req.content, tenant_id, user, file_contexts))
    flow_summary = await _safe("flow_summary",
        get_flow_summary(tenant_id, industry) if tenant_id and industry else None)

    # 管理员：获取团队通知；工人/项目经理：获取项目信息
    team_notifications = None
    user_project_info = None
    if tenant_id:
        if tenant_role in ("owner", "admin"):
            team_notifications = await _safe("team_notifications",
                context_builder.get_team_notifications(tenant_id))
        if username:
            user_project_info = await _safe("user_project_info",
                context_builder.get_user_project_info(tenant_id, username))

    # 将动作执行结果和流程提醒合并到业务上下文中
    user["_session_id"] = req.session_id  # 传给 action 用于回查最近消息
    if action_result:
        # 如果引擎返回了"需要补充信息"，强制追加防幻觉守卫
        if "需要补充信息" in action_result:
            action_result += "\n\n[灵境系统提示] ⚠️ 上述操作未成功执行！请勿声称「已录入」「已完成」「已改名」「已修改」或任何表示操作成功的表述。必须如实告知用户系统未能执行操作，并说明需要补充什么信息。"
        # 如果引擎返回了"没有找到"，说明查找失败，AI不得声称已执行
        elif "没有找到" in action_result or "未找到" in action_result:
            action_result += "\n\n[灵境系统提示] ⚠️ 重要：系统未找到指定目标，操作执行失败。请勿声称「已成功」「已完成」「已改名」「已修改」！如实告知用户系统中的实际名称，引导用户提供正确的信息。"
        business_context = (business_context or "") + "\n\n" + action_result
    elif tenant_id and re.search(r'(?:录入|录个|添加|新增|记录|保存).{0,10}(?:客户|供应商|合同)', req.content):
        # ⚠️ 防幻觉guardrail: 用户明显想执行写入操作但引擎未检测到
        business_context = (business_context or "") + "\n\n[灵境系统提示] ⚠️ 重要：用户想录入客户/供应商/合同，但系统未执行任何写入操作。请勿声称「已录入」或「已完成」！改为引导用户提供更明确的信息（如「收货人：XX，手机号：1XXXXXXXXXX」）。"
    elif tenant_id and re.search(r'(?:收货人|收件人)[：:\s]*[\u4e00-\u9fff].*1[3-9]\d{9}', req.content):
        # 用户粘贴了收货地址+手机号但引擎未触发（异常情况）
        business_context = (business_context or "") + "\n\n[灵境系统提示] ⚠️ 检测到用户发送了收货人+手机号信息，但系统未能自动录入。请引导用户明确说明意图。"
    elif tenant_id and re.search(r'(?:设[定为]|分配|指定|改[为成]|当|做).{0,10}(?:工人|项目经理|管理员|技术员)|(?:角色|身份).{0,6}(?:设|改|定|分配|给)', req.content):
        # ⚠️ 防幻觉guardrail: 用户想分配角色但引擎未检测到或执行失败
        business_context = (business_context or "") + "\n\n[灵境系统提示] ⚠️ 重要：系统未执行角色分配操作。请勿声称「已设定」或「已完成」！请引导用户明确指定成员名称和角色（如「把李阳设为项目经理」）。"
    elif tenant_id and re.search(r'(?:把|将|给)\s*\S+\s*(?:改[成为回]|改为|改成|改回|名字改[成为回]|更名为|改名[为成回]|名字改成|名称改成)', req.content):
        # ⚠️ 防幻觉guardrail: 用户想改成员名但引擎未执行
        business_context = (business_context or "") + "\n\n[灵境系统提示] ⚠️ 重要：系统未执行改名操作。请勿声称「已改名」「已修改」「已完成」或任何表示操作成功的表述！请明确告诉用户系统未能执行，并引导用户检查名称是否正确后重试。"
    elif tenant_id and (not business_context) and re.search(r'(?:有哪些|列出|查一下|看看|显示|查看|列表|多少).{0,10}(?:客户|供应商|项目|合同|工人|人员)', req.content):
        # ⚠️ 防幻觉guardrail: 用户想查看列表但系统未执行查询
        business_context = (business_context or "") + "\n\n[灵境系统提示] ⚠️ 系统未能查询到相关数据。请如实告知用户数据库中暂无此类记录，切勿自行编造名称或数据。"
    if flow_summary:
        business_context = (business_context or "") + "\n\n" + flow_summary

    # 待办事项注入（企业用户），后台异步生成 + 前台取已有项
    if tenant_id and industry:
        try:
            from services.todo_service import generate_todos
            asyncio.create_task(generate_todos(tenant_id, industry))
        except Exception as e:
            logging.getLogger("lingjing.chat").warning(
                f"generate_todos异步任务创建失败: {e}", exc_info=True)
        todo_lines = await _safe("get_todos", _get_todos_safe(tenant_id))
        if todo_lines:
            todos_text = "[灵境待办事项]\n" + "\n".join(todo_lines)
            business_context = (business_context or "") + "\n\n" + todos_text

    # 客户自动跟进
    if tenant_id and username:
        try:
            from services.followup_service import auto_followup_on_chat
            asyncio.create_task(auto_followup_on_chat(
                tenant_id, req.content, req.session_id, user.get("nickname", "")))
        except Exception:
            logging.getLogger("lingjing.chat").warning("auto_followup_on_chat异步任务创建失败", exc_info=True)

    # 交易复盘（个人用户 + 有交易记忆时触发）
    trading_review = None
    if not tenant_id and invite_code and invite_code.startswith("u_"):
        try:
            from services.trading_review import analyze_user, format_review_context
            analysis = await asyncio.wait_for(
                analyze_user(invite_code), timeout=5.0)
            trading_review = format_review_context(analysis) if analysis else None
        except (asyncio.TimeoutError, Exception):
            pass  # 复盘失败不影响主流程

    messages, memory_ids = context_builder.build_messages(
        req.content, chat_history, memories, business_context,
        tenant_info=user,
        file_contexts=file_contexts,
        team_notifications=team_notifications,
        user_project_info=user_project_info,
        trading_review=trading_review,
        cross_session_memories=cross_session_memories,
        weekly_report=weekly_report,
    )

    async def sse_generator():
        full_content = ""
        usage = {}
        try:
            # 模型路由: 显式传参 > 配置默认 > DeepSeek
            if model:
                chat_model = model if model == "ollama" else None
            elif ai_chat.config.DEFAULT_CHAT_MODEL == "ollama":
                chat_model = "ollama"
            else:
                chat_model = None
            # 本地 Ollama 模型 max_tokens 要给大一些（gemma 思考消耗 tokens）
            ollama_max_tokens = 2000 if chat_model == "ollama" else 2000

            async for chunk in ai_chat.stream_chat(messages, model=chat_model, max_tokens=ollama_max_tokens):
                if chunk["type"] == "chunk":
                    full_content += chunk["content"]
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk['content']}, ensure_ascii=False)}\n\n"
                elif chunk["type"] == "done":
                    full_content = chunk.get("content", full_content)
                    usage = chunk.get("usage", {})
                    yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                elif chunk["type"] == "error":
                    yield f"data: {json.dumps({'type': 'error', 'content': chunk['content']}, ensure_ascii=False)}\n\n"
                    return

            # 调试日志：确认AI回复完整（含名字）
            logging.getLogger("lingjing.chat").info(f"AI流完成: full_content={len(full_content)}字, 首200字: {full_content[:200]}")

            # 存储AI回复
            try:
                cost = ai_chat.estimate_cost(usage, model=chat_model)
                actual_model = chat_model or ai_chat.config.DEEPSEEK_MODEL
                async with database.pool.acquire() as conn:
                    await conn.execute(
                        """INSERT INTO chat_messages
                           (session_id, role, content, tokens_input, tokens_output,
                            cost_yuan, model_used, context_memories)
                           VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7)""",
                        req.session_id, full_content,
                        usage.get("input", 0), usage.get("output", 0),
                        cost, actual_model, memory_ids,
                    )
                    # 更新会话标题（首条消息时用用户输入的前20字作标题）和消息计数
                    await conn.execute(
                        """UPDATE chat_sessions
                           SET message_count = message_count + 2,
                               updated_at = NOW(),
                               title = CASE WHEN message_count = 0
                                            THEN $2 ELSE title END
                           WHERE session_id = $1""",
                        req.session_id, req.content[:20],
                    )
                    # 记录到 cost_tracking
                    if cost > 0:
                        partner = "deepseek" if chat_model != "ollama" else "ollama"
                        await conn.execute(
                            """INSERT INTO cost_tracking
                               (partner_id, api_call_type, tokens_input, tokens_output,
                                cost_yuan, success)
                               VALUES ($1, 'chat', $2, $3, $4, true)""",
                            partner, usage.get("input", 0), usage.get("output", 0), cost,
                        )
            except Exception as e:
                logging.getLogger("lingjing.chat").error(f"存储AI回复/session失败: {e}", exc_info=True)

            # 异步提炼记忆（后台任务，不阻塞SSE响应）
            if full_content and len(req.content) > 5:
                asyncio.create_task(
                    extract_and_store(req.content, full_content, invite_code, req.session_id,
                                       tenant_id=tenant_id, file_ids=req.file_ids or None)
                )
        except Exception as e:
            logging.getLogger("lingjing.chat").error(f"SSE生成异常: {e}\n{traceback.format_exc()}")
            yield f"data: {json.dumps({'type': 'error', 'content': f'内部错误: {str(e)[:200]}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/memories")
async def list_user_memories(
    type: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    user: dict = Depends(get_current_user),
):
    """获取用户个人记忆列表"""
    invite_code = user["code"]
    conditions = ["partner_id=$1"]
    params: list = [invite_code]
    idx = 2

    if type:
        conditions.append(f"type=${idx}")
        params.append(type)
        idx += 1

    where = "WHERE " + " AND ".join(conditions)

    async with database.pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT count(*) FROM memories {where}", *params)
        rows = await conn.fetch(
            f"""SELECT memory_id, content, type, source, priority,
                       tags, metadata, created_at
                FROM memories {where}
                ORDER BY created_at DESC
                LIMIT ${idx} OFFSET ${idx+1}""",
            *params, limit, offset,
        )

    data = []
    for r in rows:
        d = dict(r)
        d["created_at"] = d["created_at"].isoformat()
        if isinstance(d["metadata"], str):
            d["metadata"] = json.loads(d["metadata"])
        d["tags"] = list(d["tags"]) if d["tags"] else []
        data.append(d)
    return {"code": 0, "total": total, "data": data}


@router.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str, user: dict = Depends(get_current_user)):
    """删除指定记忆"""
    invite_code = user["code"]
    async with database.pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM memories WHERE memory_id=$1 AND partner_id=$2",
            memory_id, invite_code,
        )
    if result == "DELETE 0":
        return {"code": -1, "msg": "记忆不存在或无权删除"}
    return {"code": 0, "msg": "已删除"}


@router.post("/sync-memories")
async def sync_memories(user: dict = Depends(get_current_user)):
    """批量同步所有聊天记录到记忆库（跳过已提取的会话）"""
    invite_code = user["code"]
    tenant_id = user.get("tenant_id")

    async with database.pool.acquire() as conn:
        # 获取用户所有会话
        sessions = await conn.fetch(
            "SELECT session_id FROM chat_sessions WHERE invite_code=$1",
            invite_code,
        )

    total_extracted = 0
    sessions_processed = 0

    for sess in sessions:
        sid = sess["session_id"]
        async with database.pool.acquire() as conn:
            msgs = await conn.fetch(
                """SELECT role, content FROM chat_messages
                   WHERE session_id=$1 ORDER BY created_at ASC""",
                sid,
            )

        # 将消息两两配对 (user, assistant)
        i = 0
        while i < len(msgs) - 1:
            if msgs[i]["role"] == "user" and msgs[i + 1]["role"] == "assistant":
                user_msg = msgs[i]["content"] or ""
                ai_msg = msgs[i + 1]["content"] or ""
                if len(user_msg) > 5 and len(ai_msg) > 5:
                    count = await extract_and_store(
                        user_msg, ai_msg, invite_code, sid, tenant_id=tenant_id,
                    )
                    total_extracted += count
                i += 2
            else:
                i += 1
        sessions_processed += 1

    return {
        "code": 0,
        "msg": f"已处理 {sessions_processed} 个会话，新提取 {total_extracted} 条记忆",
        "sessions_processed": sessions_processed,
        "memories_extracted": total_extracted,
    }


# ── 快速打卡 ──────────────────────────────────────────

class QuickCheckinRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: str = ""
    check_type: str = "check_in"  # check_in / check_out


@router.post("/quick-checkin")
async def quick_checkin(req: QuickCheckinRequest, user: dict = Depends(get_current_user)):
    """快速打卡 - 自动关联绑定的项目"""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法打卡")

    username = user.get("code", "").replace("u_", "")
    if not username:
        raise HTTPException(status_code=400, detail="无法识别用户身份")

    async with database.pool.acquire() as conn:
        # 查找用户绑定的项目
        tu = await conn.fetchrow(
            "SELECT user_id, name, role, ext_data FROM tenant_users WHERE tenant_id=$1 AND user_id=$2",
            tenant_id, username,
        )
        if not tu:
            raise HTTPException(status_code=404, detail="您不在当前团队中")

        ext = json.loads(tu["ext_data"]) if isinstance(tu["ext_data"], str) else (tu["ext_data"] or {})
        project_id = ext.get("project_id")
        project_name = ext.get("project_name", "")

        if not project_id:
            return {"code": -1, "msg": "您还没有绑定项目，请联系管理员安排项目后再打卡"}

        # 防重复打卡
        existing = await conn.fetchval(
            """SELECT id FROM biz_attendance
               WHERE tenant_id=$1 AND user_id=$2 AND project_id=$3
               AND type=$4 AND check_time::date = CURRENT_DATE""",
            tenant_id, username, project_id, req.check_type,
        )
        type_name = "上班" if req.check_type == "check_in" else "下班"
        if existing:
            return {"code": -1, "msg": f"您今天已经打过{type_name}卡了"}

        now = datetime.now()

        # AI审批
        approval = await evaluate_checkin(
            tenant_id, username, project_id, now,
            latitude=req.latitude, longitude=req.longitude,
        )
        status = approval["result"]  # normal / flagged

        await conn.execute(
            """INSERT INTO biz_attendance
               (tenant_id, project_id, user_id, user_name, type,
                check_time, latitude, longitude, address, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
            tenant_id, project_id, username, tu["name"], req.check_type,
            now, req.latitude, req.longitude, req.address, status,
        )

        # 如果异常，生成管理员通知
        if status == "flagged":
            reasons = [c["reason"] for c in approval["checks"] if not c.get("pass") and c.get("reason")]
            await conn.execute(
                """INSERT INTO tenant_notifications
                   (tenant_id, type, target_user_id, target_user_name, data)
                   VALUES ($1, 'attendance_flagged', $2, $3, $4)""",
                tenant_id, username, tu["name"],
                json.dumps({
                    "check_type": req.check_type,
                    "time": now.isoformat(),
                    "reasons": reasons,
                    "project_name": project_name,
                }, ensure_ascii=False),
            )

    result = {
        "code": 0,
        "msg": f"{type_name}打卡成功",
        "data": {
            "check_type": type_name,
            "time": now.strftime("%H:%M"),
            "project": project_name,
            "status": status,
        },
    }
    if status == "flagged":
        flagged_reasons = [c.get("reason", "") for c in approval["checks"] if not c.get("pass")]
        result["data"]["warning"] = "；".join(r for r in flagged_reasons if r)
    return result


class TranscribeRequest(BaseModel):
    audio_base64: str
    filename: str = "audio.m4a"


@router.post("/transcribe")
async def transcribe_audio(req: TranscribeRequest, user=Depends(get_current_user)):
    """将 base64 音频转为文字（Whisper 模型）"""
    if not req.audio_base64:
        raise HTTPException(status_code=400, detail="audio_base64 不能为空")
    try:
        text = await asyncio.to_thread(
            transcribe_base64, req.audio_base64, req.filename
        )
        return {"code": 0, "text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转写失败: {str(e)}")
