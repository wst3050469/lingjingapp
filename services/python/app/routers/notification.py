"""
灵境 - 通知/待办中心 API 路由
提供红点数、通知列表、标记已读等接口
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import sys, os, logging, asyncio

logger = logging.getLogger("lingjing.notification")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from services.notification_service import (
    get_unread_count,
    get_notifications,
    mark_read,
    mark_all_read,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["通知中心"])


# ===== 辅助：从 token 获取当前用户（多表查找，兼容多重身份系统） =====
async def get_current_user_from_token(token: str = Query(..., description="登录Token")):
    """从 token 查找用户，依次尝试 invite_codes、users、tenant_users 表"""
    async with database.pool.acquire() as conn:
        # 1. invite_codes (邀请码登录)
        row = await conn.fetchrow(
            "SELECT code, nickname FROM invite_codes WHERE token=$1 AND status='active'",
            token,
        )
        if row:
            return {"user_id": row["code"], "nickname": row["nickname"]}

        # 2. users (账号密码登录)
        row = await conn.fetchrow(
            "SELECT u.username, u.nickname FROM users u WHERE u.token=$1 AND u.status='active'",
            token,
        )
        if row:
            return {"user_id": row["username"], "nickname": row["nickname"]}

        # 3. tenant_users (微信/企业微信登录，token存储在ext_data中)
        row = await conn.fetchrow(
            "SELECT user_id, name FROM tenant_users WHERE ext_data->>'token' = $1 AND status='active'",
            token,
        )
        if row:
            return {"user_id": row["user_id"], "nickname": row["name"]}

    raise HTTPException(status_code=401, detail="Token无效或已过期")


@router.get("/unread-count")
async def unread_count(token: str = Query(...)):
    """获取当前用户未读通知数（红点数字）"""
    user = await get_current_user_from_token(token)
    count = await get_unread_count(user["user_id"])
    return {"code": 0, "unread_count": count}


@router.get("/list")
async def list_notifications(
    token: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event_type: str = Query("", description="按事件类型筛选"),
    is_read: Optional[bool] = Query(None, description="已读/未读筛选"),
):
    """获取通知列表"""
    user = await get_current_user_from_token(token)
    notifications = await get_notifications(
        user_id=user["user_id"],
        limit=limit,
        offset=offset,
        event_type=event_type,
        is_read=is_read,
    )
    return {"code": 0, "notifications": notifications, "total": len(notifications)}


@router.post("/{notification_id}/read")
async def read_notification(notification_id: int, token: str = Query(...)):
    """标记单条通知已读"""
    user = await get_current_user_from_token(token)
    ok = await mark_read(user["user_id"], notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="通知不存在或已读")
    return {"code": 0, "msg": "已标记已读"}


@router.post("/read-all")
async def read_all_notifications(token: str = Query(...)):
    """全部标记已读"""
    user = await get_current_user_from_token(token)
    count = await mark_all_read(user["user_id"])
    return {"code": 0, "msg": f"已标记{count}条为已读", "count": count}


# ===== 待办中心（兼容旧 todo_items） =====
@router.get("/todos")
async def list_todos(
    token: str = Query(...),
    limit: int = Query(30, ge=1, le=100),
    status: str = Query("pending"),
):
    """获取待办列表（自动刷新 + 角色区分）"""
    user = await get_current_user_from_token(token)
    user_id = user["user_id"]

    # 获取 tenant_id
    tenant_id = None
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT tenant_id, role FROM tenant_users WHERE user_id=$1 AND status='active' LIMIT 1",
            user_id,
        )
        if row:
            tenant_id = row["tenant_id"]
            user_role = row["role"]

    # 异步刷新待办（fire-and-forget）
    if tenant_id:
        try:
            from services.todo_service import generate_todos, generate_todos_for_user
            # 管理员角色：刷新全team待办
            if user_role in ("owner", "admin"):
                asyncio.create_task(generate_todos(tenant_id, "", None))
            # 所有角色：刷新个人待办
            asyncio.create_task(generate_todos_for_user(tenant_id, user_id))
        except Exception as e:
            logger.warning(f"通知列表生成后台任务失败: {e}")

    # 用 todo_service 的标准化查询（含 user_id 过滤 + 角色过滤）
    from services.todo_service import get_todos
    todos = await get_todos(tenant_id or "", limit=limit, user_id=user_id, status=status, user_role=user_role)
    return {"code": 0, "todos": todos, "total": len(todos)}


@router.post("/todos/refresh")
async def refresh_todos(token: str = Query(...)):
    """手动刷新待办"""
    user = await get_current_user_from_token(token)
    user_id = user["user_id"]

    tenant_id = None
    user_role = "member"
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT tenant_id, role FROM tenant_users WHERE user_id=$1 AND status='active' LIMIT 1",
            user_id,
        )
        if row:
            tenant_id = row["tenant_id"]
            user_role = row["role"]

    if not tenant_id:
        return {"code": 0, "msg": "非企业用户", "count": 0}

    from services.todo_service import generate_todos, generate_todos_for_user
    if user_role in ("owner", "admin"):
        await generate_todos(tenant_id, "", None)
    result = await generate_todos_for_user(tenant_id, user_id)
    return {"code": 0, "msg": f"已刷新{len(result)}项个人待办", "count": len(result)}


@router.post("/todos/{todo_id}/done")
async def complete_todo(todo_id: int, token: str = Query(...)):
    """完成待办"""
    user = await get_current_user_from_token(token)
    from services.todo_service import mark_done
    # 需要 tenant_id，从 todo_items 查找
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, title, tenant_id FROM todo_items WHERE id=$1 AND status='pending'",
            todo_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="待办不存在或已完成")
        tenant_id = row["tenant_id"]
    result = await mark_done(todo_id, tenant_id, user["user_id"])
    if not result:
        raise HTTPException(status_code=404, detail="操作失败")
    return {"code": 0, "msg": f"待办「{row['title']}」已完成", "id": todo_id}
