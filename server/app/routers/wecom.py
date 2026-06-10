"""灵境 - 企业微信（WeCom）消息同步路由

提供：
1. GET /callback — 企业微信回调URL接入验证
2. POST /callback — 接收企业微信消息推送
3. GET /config — 获取企业微信配置状态
4. PUT /config — 更新企业微信配置
5. POST /test-connection — 测试API连通性
6. POST /sync-contacts — 手动同步通讯录
7. POST /test-push — 模拟消息推送（调试）
8. GET /stats — 同步统计
"""
import json
import logging
import os
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Form, Body
from fastapi.responses import PlainTextResponse

import db as database
import config
from .auth import get_current_user

logger = logging.getLogger("lingjing.wecom_router")
router = APIRouter(prefix="/api/v1/wecom", tags=["wecom"])


# ── 配置缓存 ────────────────────────────────────────────────

_db_config_cache = None
_db_config_cache_time = 0


async def _get_wecom_config():
    """获取企业微信配置（优先数据库，回退.env）
    
    返回: (corp_id, agent_id, agent_secret, token, aes_key, tenant_id)
    """
    global _db_config_cache, _db_config_cache_time
    now = time.time()

    if _db_config_cache and now - _db_config_cache_time < 60:
        return _db_config_cache

    corp_id = os.environ.get("WECOM_CORP_ID", config.WECOM_CORP_ID)
    agent_id = os.environ.get("WECOM_AGENT_ID", str(config.WECOM_AGENT_ID))
    agent_secret = os.environ.get("WECOM_AGENT_SECRET", config.WECOM_AGENT_SECRET)
    token = os.environ.get("WECOM_CALLBACK_TOKEN", config.WECOM_CALLBACK_TOKEN)
    aes_key = os.environ.get("WECOM_CALLBACK_AES_KEY", config.WECOM_CALLBACK_AES_KEY)
    tenant_id = ""

    try:
        async with database.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT corp_id, agent_id, agent_secret, token, encoding_aes_key, tenant_id FROM wecom_config LIMIT 1"
            )
            if row:
                db_corp_id = row["corp_id"] or ""
                db_secret = row["agent_secret"] or ""
                if db_corp_id and db_secret:
                    corp_id = db_corp_id
                    agent_id = str(row["agent_id"] or config.WECOM_AGENT_ID)
                    agent_secret = db_secret
                    if row["token"]:
                        token = row["token"]
                    if row["encoding_aes_key"]:
                        aes_key = row["encoding_aes_key"]
                    if row["tenant_id"]:
                        tenant_id = row["tenant_id"]
    except Exception:
        pass

    _db_config_cache = (corp_id, agent_id, agent_secret, token, aes_key, tenant_id)
    _db_config_cache_time = now
    return corp_id, agent_id, agent_secret, token, aes_key, tenant_id


async def _is_configured() -> bool:
    corp_id, _, agent_secret, _, _, _ = await _get_wecom_config()
    return bool(corp_id) and bool(agent_secret)


# ── 权限辅助 ──────────────────────────────────────────────

ALLOWED_ROLES = ("owner", "project_manager")


def _require_wecom_access(user: dict):
    role = user.get("tenant_role") or ""
    if role not in ALLOWED_ROLES:
        raise HTTPException(403, "仅租户管理员和项目经理可管理企业微信配置")


def _check_tenant_access(user: dict, tenant_id: str):
    if not tenant_id:
        raise HTTPException(400, "缺少 tenant_id")
    if user.get("tenant_id") and user["tenant_id"] != tenant_id:
        raise HTTPException(403, "无权操作该租户的数据")


# ── 1. 回调URL接入验证（GET）───────────────────────────────

@router.get("/callback")
async def verify_callback_url(
    msg_signature: str = Query(""),
    timestamp: str = Query(""),
    nonce: str = Query(""),
    echostr: str = Query(""),
):
    """企业微信回调URL接入验证（GET请求）"""
    _, _, _, token, aes_key, _ = await _get_wecom_config()

    from services.wecom_service import verify_url
    result = verify_url(aes_key, token, msg_signature, timestamp, nonce, echostr)
    if result is not None:
        return PlainTextResponse(result)
    raise HTTPException(403, "URL验证失败")


# ── 2. 接收消息推送（POST）────────────────────────────────

@router.post("/callback")
async def receive_message(request: Request):
    """接收企业微信服务器推送的消息（POST）"""
    _, _, _, token, aes_key, tenant_id = await _get_wecom_config()

    from services.wecom_service import (
        parse_callback_xml,
        convert_to_wechat_message,
    )

    # 验证签名
    msg_signature = request.query_params.get("msg_signature", "")
    timestamp = request.query_params.get("timestamp", "")
    nonce = request.query_params.get("nonce", "")

    body = await request.body()
    body_str = body.decode("utf-8")

    # 签名已在cloud-server的wecom.js中验证通过，此处不再重复验签
    # 直接解析XML处理消息
    logger.info(f"收到企业微信消息回调: body_len={len(body_str)}, sig={msg_signature[:16]}...")

    # 解析XML
    try:
        wx_msg = parse_callback_xml(body)
    except Exception as e:
        logger.error(f"XML解析失败: {e}")
        return PlainTextResponse("success")

    msg_type = wx_msg.get("MsgType", "unknown")
    from_user = wx_msg.get("FromUserName", "")
    logger.info(f"收到企业微信消息: type={msg_type}, from={from_user}")

    # 事件消息处理
    if msg_type == "event":
        event = wx_msg.get("Event", "")
        logger.info(f"收到企业微信事件: {event}")
        return PlainTextResponse("success")

    # 没有配置租户则无法存储
    if not tenant_id:
        logger.info(f"企业微信未绑定租户，消息暂不存储: from={from_user}")
        return PlainTextResponse("success")

    # 提取群聊信息（企业微信回调中群聊消息含有ChatId字段）
    chat_id = wx_msg.get("ChatId", "")
    group_name = wx_msg.get("FromGroup", "")
    if not group_name and chat_id:
        group_name = f"企微群_{chat_id[:8]}"
    if not group_name:
        group_name = "企业微信群聊"

    # 转换为灵境消息格式
    msg_data = convert_to_wechat_message(wx_msg)

    # 存储到数据库
    try:
        from services.wechat_service import ensure_group, save_messages_batch

        async with database.pool.acquire() as conn:
            group_id = await ensure_group(conn, tenant_id, group_name, member_count=0)
            result = await save_messages_batch(conn, group_id, tenant_id, [msg_data])

        logger.info(f"企业微信消息已同步: tenant={tenant_id}, group={group_id}, "
                     f"inserted={result['inserted']}")
    except Exception as e:
        logger.error(f"存储消息失败: {e}")

    return PlainTextResponse("success")


# ── 3. 获取配置状态 ────────────────────────────────────────

@router.get("/config")
async def get_config(user: dict = Depends(get_current_user)):
    """获取企业微信配置状态"""
    _require_wecom_access(user)
    corp_id, agent_id, _, token, _, tenant_id = await _get_wecom_config()
    configured = await _is_configured()
    return {
        "configured": configured,
        "corp_id": corp_id[:4] + "****" if corp_id and len(corp_id) > 4 else corp_id,
        "agent_id": int(agent_id) if agent_id else 0,
        "token": token[:4] + "****" if token and len(token) > 4 else "",
        "tenant_id": tenant_id,
        "msg": "已配置" if configured else "未配置，请在企业微信管理后台创建自建应用",
    }


# ── 4. 更新配置 ─────────────────────────────────────────────

@router.put("/config")
async def update_config(
    data: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """更新企业微信配置"""
    _require_wecom_access(user)

    corp_id = (data.get("corp_id") or "").strip()
    agent_id = int(data.get("agent_id", 0))
    agent_secret = (data.get("agent_secret") or "").strip()
    token = (data.get("token") or "").strip()
    aes_key = (data.get("encoding_aes_key") or "").strip()
    tenant_id = (data.get("tenant_id") or "").strip()

    # 如果user本身有tenant_id且未指定，使用用户的租户
    if not tenant_id and user.get("tenant_id"):
        tenant_id = user["tenant_id"]

    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM wecom_config LIMIT 1")
        if existing:
            if agent_secret in ("", "******"):
                old = await conn.fetchrow(
                    "SELECT agent_secret FROM wecom_config WHERE id=$1", existing["id"]
                )
                if old and old["agent_secret"]:
                    agent_secret = old["agent_secret"]
            await conn.execute(
                """UPDATE wecom_config SET corp_id=$1, agent_id=$2, agent_secret=$3,
                   token=$4, encoding_aes_key=$5, tenant_id=$6,
                   updated_by=$7, updated_at=NOW()
                   WHERE id=$8""",
                corp_id, agent_id, agent_secret, token, aes_key, tenant_id,
                user.get("code", ""), existing["id"],
            )
        else:
            await conn.execute(
                """INSERT INTO wecom_config
                   (corp_id, agent_id, agent_secret, token, encoding_aes_key, tenant_id, updated_by)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                corp_id, agent_id, agent_secret, token, aes_key, tenant_id,
                user.get("code", ""),
            )

    global _db_config_cache
    _db_config_cache = None

    return {
        "code": 0,
        "msg": "企业微信配置已更新",
        "corp_id": corp_id[:4] + "****" if len(corp_id) > 4 else corp_id,
        "tenant_id": tenant_id,
    }


# ── 5. 测试连通性 ────────────────────────────────────────────

@router.post("/test-connection")
async def test_connection(user: dict = Depends(get_current_user)):
    """测试企业微信API连通性"""
    _require_wecom_access(user)

    corp_id, _, agent_secret, _, _, _ = await _get_wecom_config()
    if not corp_id or not agent_secret:
        return {"ok": False, "msg": "未配置 CorpID 或 Secret"}

    from services.wecom_service import get_access_token
    token = await get_access_token(corp_id, agent_secret)
    if token:
        return {"ok": True, "msg": "连接成功，access_token 获取正常"}
    else:
        return {"ok": False, "msg": "获取 access_token 失败，请检查 CorpID 和 Secret"}


# ── 6. 同步通讯录 ──────────────────────────────────────────

@router.post("/sync-contacts")
async def sync_contacts(
    tenant_id: str = Form(""),
    user: dict = Depends(get_current_user),
):
    """手动同步企业微信通讯录"""
    _require_wecom_access(user)
    _check_tenant_access(user, tenant_id)

    corp_id, _, agent_secret, _, _, _ = await _get_wecom_config()
    if not corp_id or not agent_secret:
        raise HTTPException(400, "企业微信未配置")

    from services.wecom_service import get_access_token, sync_contacts as sync_wecom_contacts
    token = await get_access_token(corp_id, agent_secret)
    if not token:
        raise HTTPException(500, "获取access_token失败")

    result = await sync_wecom_contacts(token)

    # 存储到wecom_corp_users表
    stored = 0
    try:
        async with database.pool.acquire() as conn:
            for u in result.get("users", []):
                try:
                    await conn.execute(
                        """INSERT INTO wecom_corp_users
                           (userid, name, department, mobile, avatar, status)
                           VALUES ($1, $2, $3, $4, $5, $6)
                           ON CONFLICT (userid) DO UPDATE SET
                           name=EXCLUDED.name, department=EXCLUDED.department,
                           mobile=EXCLUDED.mobile, avatar=EXCLUDED.avatar,
                           status=EXCLUDED.status, updated_at=NOW()""",
                        u.get("userid", ""),
                        u.get("name", ""),
                        u.get("department", []),
                        u.get("mobile", ""),
                        u.get("avatar", ""),
                        u.get("status", 1),
                    )
                    stored += 1
                except Exception as e:
                    logger.warning(f"存储成员{u.get('userid')}失败: {e}")
    except Exception as e:
        logger.error(f"批量存储通讯录异常: {e}")

    return {
        "ok": True,
        "total_users": result["total"],
        "stored": stored,
        "departments": len(result["departments"]),
        "msg": f"同步完成，共 {result['total']} 名成员",
    }


# ── 7. 模拟消息推送（调试）────────────────────────────────

@router.post("/test-push")
async def test_push_message(
    tenant_id: str = Form(...),
    content: str = Form("这是一条测试消息"),
    sender: str = Form("测试人员"),
    group_name: str = Form("企业微信测试群"),
    user: dict = Depends(get_current_user),
):
    """模拟企业微信消息推送，用于测试消息同步流程"""
    _require_wecom_access(user)
    _check_tenant_access(user, tenant_id)

    from services.wecom_service import convert_to_wechat_message
    from services.wechat_service import ensure_group, save_messages_batch

    mock_msg = {
        "MsgType": "text",
        "FromUserName": sender,
        "ToUserName": "wecom_test",
        "Content": content,
        "CreateTime": str(int(time.time())),
        "MsgId": str(int(time.time() * 1000)),
    }

    msg_data = convert_to_wechat_message(mock_msg)

    async with database.pool.acquire() as conn:
        group_id = await ensure_group(conn, tenant_id, group_name, member_count=0)
        result = await save_messages_batch(conn, group_id, tenant_id, [msg_data])

    return {
        "status": "ok",
        "group_id": group_id,
        "group_name": group_name,
        "message": content,
        "inserted": result["inserted"],
        "msg": "测试消息已推送成功，可在群聊列表中查看",
    }


# ── 8. 同步统计 ─────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    """获取企业微信同步统计"""
    _require_wecom_access(user)
    _check_tenant_access(user, tenant_id)

    async with database.pool.acquire() as conn:
        config_row = await conn.fetchrow(
            "SELECT corp_id, callback_enabled, tenant_id, updated_at FROM wecom_config LIMIT 1"
        )
        total_messages = await conn.fetchval(
            "SELECT COUNT(*) FROM wechat_messages WHERE tenant_id=$1",
            tenant_id,
        )
        synced_today = await conn.fetchval(
            """SELECT COUNT(*) FROM wechat_messages
               WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '24 hours'""",
            tenant_id,
        )
        bound_users = await conn.fetchval("SELECT COUNT(*) FROM wecom_corp_users")

    return {
        "configured": config_row is not None and bool(config_row["corp_id"]),
        "callback_enabled": config_row["callback_enabled"] if config_row else False,
        "config_updated_at": config_row["updated_at"].isoformat() if config_row and config_row["updated_at"] else "",
        "config_tenant_id": config_row["tenant_id"] if config_row else "",
        "sync_stats": {
            "total_messages": total_messages or 0,
            "synced_today": synced_today or 0,
            "bound_users": bound_users or 0,
        },
    }
