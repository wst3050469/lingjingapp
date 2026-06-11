"""
灵境平台 - 统一推送服务
WebSocket 直推（首选） + 极光 JPush（可选备用）
"""
import os
import sys
import logging

logger = logging.getLogger("lingjing.push")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from services.ws_manager import ConnectionManager


async def _ws_push(user_ids: list[str], title: str, content: str, extras: dict | None = None) -> int:
    """WebSocket 推送，返回成功送达数"""
    return await ConnectionManager.send_to_users(user_ids, {
        "type": "notification",
        "title": title,
        "body": content,
        "extras": extras or {},
    })


async def push_to_user(username: str, title: str, content: str, extras: dict | None = None) -> bool:
    """推送给指定用户（WS 优先）"""
    return (await _ws_push([username], title, content, extras)) > 0


async def push_to_tenant_admins(tenant_id: str, title: str, content: str, extras: dict | None = None) -> bool:
    """推送给租户管理员"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT tu.user_id FROM tenant_users tu
            WHERE tu.tenant_id = $1 AND tu.role IN ('owner', 'admin')""", tenant_id)
    user_ids = [r["user_id"] for r in rows]
    if not user_ids:
        return False
    return (await _ws_push(user_ids, title, content, extras)) > 0


async def push_to_tenant_members(tenant_id: str, title: str, content: str,
                                  exclude_user: str | None = None, extras: dict | None = None) -> bool:
    """推送给租户所有成员"""
    async with database.pool.acquire() as conn:
        if exclude_user:
            rows = await conn.fetch("""
                SELECT tu.user_id FROM tenant_users tu
                WHERE tu.tenant_id = $1 AND tu.user_id != $2""", tenant_id, exclude_user)
        else:
            rows = await conn.fetch("""
                SELECT tu.user_id FROM tenant_users tu WHERE tu.tenant_id = $1""", tenant_id)
    user_ids = [r["user_id"] for r in rows]
    if not user_ids:
        return False
    return (await _ws_push(user_ids, title, content, extras)) > 0


async def send_push(title: str, content: str, registration_ids: list[str] | None = None,
                    extras: dict | None = None, alias: str | None = None) -> bool:
    """兼容旧接口：JPush REST API（已弃用，走 WS）"""
    if alias:
        return await push_to_user(alias, title, content, extras)
    if registration_ids:
        return (await _ws_push(registration_ids, title, content, extras)) > 0
    return False


async def register_push_token(username: str, push_token: str, platform: str = "android") -> bool:
    """注册推送 token（兼容旧接口，仅记录）"""
    try:
        async with database.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_push_tokens (user_id, push_token, platform, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id) DO UPDATE SET push_token=$2, platform=$3, updated_at=NOW()""",
                username, push_token, platform)
        return True
    except Exception as e:
        logger.error(f"Register push token failed: {e}")
        return False
