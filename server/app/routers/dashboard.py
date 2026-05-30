"""灵境 - 仪表盘API（首页概览数据）"""
import logging
from fastapi import APIRouter, Depends
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from .auth import get_current_user

logger = logging.getLogger("lingjing.dashboard")
router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/overview")
async def get_dashboard(user: dict = Depends(get_current_user)):
    """获取仪表盘概览数据 - 精简版，仅返回基本统计（APP已直跳AI对话）"""
    code = user.get("code", "")
    tenant_id = user.get("tenant_id", "")
    partner_id = code
    username = code[2:] if code.startswith("u_") else code

    result = {
        "stats": {},
        "recent_notifications": [],
        "pending_todos": [],
        "recent_memories": [],
        "quick_actions": [],
    }

    try:
        async with database.pool.acquire() as conn:
            mem_count = await conn.fetchval(
                "SELECT COUNT(*) FROM memories WHERE partner_id=$1", partner_id
            )
            todo_pending = await conn.fetchval(
                "SELECT COUNT(*) FROM todo_items WHERE tenant_id=$1 AND status='pending'", tenant_id
            )
            notif_unread = await conn.fetchval(
                "SELECT COUNT(*) FROM notifications WHERE target_user_id=$1 AND is_read=false", username
            )
            result["stats"] = {
                "memories": mem_count or 0,
                "pending_todos": todo_pending or 0,
                "unread_notifications": notif_unread or 0,
            }
    except Exception as e:
        logger.error("获取仪表盘统计异常: user=%s tenant=%s error=%s", code, tenant_id, str(e), exc_info=True)

    return result
