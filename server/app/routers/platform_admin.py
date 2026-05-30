"""灵境平台 - 平台超级管理员API"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel
from .auth import get_admin_user

router = APIRouter(prefix="/api/v1/platform-admin", tags=["platform-admin"])

def require_super_admin(admin: dict):
    if admin.get("role") not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="需要超级管理员权限")
    return admin

class RespondFeedbackRequest(BaseModel):
    response: str

# ==================== 用户审核 ====================

@router.get("/pending-users")
async def list_pending_users(admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT u.id, u.username, u.nickname, u.account_type,
                      u.tenant_id, u.created_at,
                      t.company_name, t.industry
               FROM users u
               LEFT JOIN tenants t ON u.tenant_id = t.tenant_id
               WHERE u.status = 'pending'
               ORDER BY u.created_at DESC"""
        )
    return {"code": 0, "data": [{
        "id": r["id"], "username": r["username"], "nickname": r["nickname"],
        "account_type": r["account_type"], "tenant_id": r["tenant_id"],
        "company_name": r["company_name"], "industry": r["industry"],
        "created_at": str(r["created_at"]),
    } for r in rows]}


@router.post("/approve-user/{username}")
async def approve_user(username: str, admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT id, tenant_id FROM users WHERE username=$1 AND status='pending'", username)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在或已处理")
        async with conn.transaction():
            await conn.execute("UPDATE users SET status='active' WHERE username=$1", username)
            if user["tenant_id"]:
                await conn.execute("UPDATE tenants SET status='active' WHERE tenant_id=$1", user["tenant_id"])
    return {"code": 0, "msg": f"用户 {username} 审核通过"}


@router.post("/reject-user/{username}")
async def reject_user(username: str, admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT id, tenant_id FROM users WHERE username=$1 AND status='pending'", username)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在或已处理")
        async with conn.transaction():
            await conn.execute("UPDATE users SET status='disabled' WHERE username=$1", username)
            if user["tenant_id"]:
                await conn.execute("UPDATE tenants SET status='disabled' WHERE tenant_id=$1", user["tenant_id"])
    return {"code": 0, "msg": f"用户 {username} 已拒绝"}


# ==================== 租户管理 ====================

@router.get("/tenants")
async def list_all_tenants(
    admin: dict = Depends(get_admin_user),
    status: str = None,
):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        if status:
            rows = await conn.fetch(
                "SELECT tenant_id, company_name, category, industry, status, owner_name, owner_phone, created_at "
                "FROM tenants WHERE status=$1 ORDER BY created_at DESC", status)
        else:
            rows = await conn.fetch(
                "SELECT tenant_id, company_name, category, industry, status, owner_name, owner_phone, created_at "
                "FROM tenants ORDER BY created_at DESC")
        result = []
        for r in rows:
            count = await conn.fetchval(
                "SELECT count(*) FROM users WHERE tenant_id=$1", r["tenant_id"])
            result.append({
                "tenant_id": r["tenant_id"],
                "company_name": r["company_name"],
                "category": r.get("category", ""),
                "industry": r["industry"],
                "status": r["status"],
                "owner_name": r["owner_name"],
                "owner_phone": r["owner_phone"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "user_count": count,
            })
    return {"code": 0, "data": result}


@router.post("/tenants")
async def create_tenant(
    tenant_id: str = Body(...),
    company_name: str = Body(...),
    category: str = Body('floor'),
    industry: str = Body(''),
    owner_name: str = Body(''),
    owner_phone: str = Body(''),
    admin: dict = Depends(get_admin_user),
):
    """超管创建租户（支持选择分类）"""
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        existing = await conn.fetchval("SELECT id FROM tenants WHERE tenant_id=$1", tenant_id)
        if existing:
            raise HTTPException(status_code=409, detail="租户ID已存在")
        await conn.execute(
            """INSERT INTO tenants (tenant_id, company_name, category, industry, owner_name, owner_phone)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            tenant_id, company_name, category, industry, owner_name, owner_phone,
        )
    return {"code": 0, "msg": f"租户 {company_name} 创建成功"}


@router.put("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    body: dict = Body(...),
    admin: dict = Depends(get_admin_user),
):
    """超管编辑租户（名称、分类等）"""
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM tenants WHERE tenant_id=$1", tenant_id)
        if not existing:
            raise HTTPException(status_code=404, detail="租户不存在")
        updates = []
        params = []
        idx = 1
        for field in ('company_name', 'category', 'industry', 'owner_name', 'owner_phone'):
            if field in body:
                updates.append(f"{field}=${idx}")
                params.append(body[field])
                idx += 1
        if not updates:
            return {"code": 0, "msg": "无变更"}
        params.append(tenant_id)
        await conn.execute(
            f"UPDATE tenants SET {', '.join(updates)}, updated_at=NOW() WHERE tenant_id=${idx}",
            *params,
        )
    return {"code": 0, "msg": "租户信息已更新"}


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    admin: dict = Depends(get_admin_user),
):
    """超管删除租户"""
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM tenants WHERE tenant_id=$1", tenant_id)
        if not existing:
            raise HTTPException(status_code=404, detail="租户不存在")
        # 删除租户相关数据
        await conn.execute("DELETE FROM users WHERE tenant_id=$1", tenant_id)
        await conn.execute("DELETE FROM tenant_users WHERE tenant_id=$1", tenant_id)
        await conn.execute("DELETE FROM tenant_invite_codes WHERE tenant_id=$1", tenant_id)
        await conn.execute("DELETE FROM tenants WHERE tenant_id=$1", tenant_id)
    return {"code": 0, "msg": f"租户 {tenant_id} 已删除"}


# ==================== API Keys 管理 ====================

@router.get("/api-keys")
async def list_api_keys(admin: dict = Depends(get_admin_user)):
    """获取所有 API Keys"""
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, api_key, name, description, tenant_id, created_by, status, last_used_at, created_at
               FROM api_keys ORDER BY created_at DESC"""
        )
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.post("/api-keys")
async def create_api_key(
    req: dict,
    admin: dict = Depends(get_admin_user),
):
    """创建新 API Key（生成随机key）"""
    require_super_admin(admin)
    import uuid
    api_key = f"lj_{uuid.uuid4().hex[:24]}"
    name = req.get("name", "").strip() or "未命名"
    description = req.get("description", "").strip()
    tenant_id = req.get("tenant_id", "").strip() or None
    
    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO api_keys (api_key, name, description, tenant_id, created_by)
               VALUES ($1, $2, $3, $4, $5)""",
            api_key, name, description, tenant_id, admin.get("username", "super_admin"),
        )
    return {"code": 0, "api_key": api_key, "msg": f"API Key '{name}' 创建成功"}


@router.put("/api-keys/{key_id}/revoke")
async def revoke_api_key(
    key_id: int,
    admin: dict = Depends(get_admin_user),
):
    """作废 API Key"""
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE api_keys SET status='revoked' WHERE id=$1",
            key_id,
        )
    return {"code": 0, "msg": "API Key 已作废"}


# ==================== 租户审核 ====================

@router.get("/pending-tenants")
async def list_pending_tenants(admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT t.tenant_id, t.company_name, t.industry, t.owner_name,
                      t.owner_phone, t.plan, t.created_at,
                      u.username, u.nickname AS user_nickname
               FROM tenants t
               LEFT JOIN users u ON u.tenant_id = t.tenant_id AND u.account_type = 'enterprise'
               WHERE t.status = 'pending'
               ORDER BY t.created_at DESC""")
    tenants = {}
    for r in rows:
        tid = r["tenant_id"]
        if tid not in tenants:
            tenants[tid] = {
                "tenant_id": tid, "company_name": r["company_name"],
                "industry": r["industry"], "owner_name": r["owner_name"],
                "owner_phone": r["owner_phone"], "plan": r["plan"],
                "created_at": str(r["created_at"]), "users": []}
        if r["username"]:
            tenants[tid]["users"].append({"username": r["username"], "nickname": r["user_nickname"]})
    return {"code": 0, "data": list(tenants.values())}


@router.post("/approve-tenant/{tenant_id}")
async def approve_tenant(tenant_id: str, admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        t = await conn.fetchrow("SELECT tenant_id FROM tenants WHERE tenant_id=$1 AND status='pending'", tenant_id)
        if not t: raise HTTPException(status_code=404, detail="租户不存在或已处理")
        async with conn.transaction():
            await conn.execute("UPDATE tenants SET status='active' WHERE tenant_id=$1", tenant_id)
            await conn.execute("UPDATE users SET status='active' WHERE tenant_id=$1 AND status='pending'", tenant_id)
    return {"code": 0, "msg": f"租户 {tenant_id} 已审核通过"}


@router.post("/reject-tenant/{tenant_id}")
async def reject_tenant(tenant_id: str, admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        t = await conn.fetchrow("SELECT tenant_id FROM tenants WHERE tenant_id=$1 AND status='pending'", tenant_id)
        if not t: raise HTTPException(status_code=404, detail="租户不存在或已处理")
        async with conn.transaction():
            await conn.execute("UPDATE tenants SET status='disabled' WHERE tenant_id=$1", tenant_id)
            await conn.execute("UPDATE users SET status='disabled' WHERE tenant_id=$1 AND status='pending'", tenant_id)
    return {"code": 0, "msg": f"租户 {tenant_id} 已拒绝"}


# ==================== 反馈管理 ====================

@router.get("/feedback")
async def list_feedback(
    status: str = Query(None),
    ftype: str = Query(None, alias="type"),
    admin: dict = Depends(get_admin_user),
):
    require_super_admin(admin)
    clauses, params, idx = [], [], 1
    if status:
        clauses.append(f"status=${idx}"); params.append(status); idx += 1
    if ftype:
        clauses.append(f"type=${idx}"); params.append(ftype); idx += 1
    where = " AND ".join(clauses) if clauses else "1=1"
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT * FROM platform_feedback WHERE {where} ORDER BY created_at DESC LIMIT 100", *params)
    return {"code": 0, "data": [{
        "id": r["id"], "user_code": r["user_code"], "user_nickname": r["user_nickname"],
        "type": r["type"], "content": r["content"], "status": r["status"],
        "admin_response": r["admin_response"], "responded_by": r["responded_by"],
        "created_at": str(r["created_at"]),
    } for r in rows]}


@router.post("/feedback/{feedback_id}/respond")
async def respond_feedback(feedback_id: int, req: RespondFeedbackRequest, admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        fb = await conn.fetchrow("SELECT id FROM platform_feedback WHERE id=$1", feedback_id)
        if not fb: raise HTTPException(status_code=404, detail="反馈记录不存在")
        await conn.execute(
            "UPDATE platform_feedback SET admin_response=$1, responded_by=$2, status='completed', updated_at=NOW() WHERE id=$3",
            req.response.strip(), admin["nickname"], feedback_id)
    return {"code": 0, "msg": "回复成功"}


@router.post("/feedback/{feedback_id}/mark")
async def mark_feedback(feedback_id: int, status: str = Query(...), admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    if status not in ("pending", "processing", "completed", "declined"):
        raise HTTPException(status_code=422, detail="无效状态")
    async with database.pool.acquire() as conn:
        await conn.execute("UPDATE platform_feedback SET status=$1, updated_at=NOW() WHERE id=$2", status, feedback_id)
    return {"code": 0, "msg": f"已标记为 {status}"}


# ==================== 用户管理 ====================

@router.get("/users")
async def list_all_users(
    admin: dict = Depends(get_admin_user),
    account_type: str = Query(None),
    status_filter: str = Query(None, alias="status"),
):
    require_super_admin(admin)
    clauses, params, idx = [], [], 1
    if account_type:
        clauses.append(f"u.account_type=${idx}"); params.append(account_type); idx += 1
    if status_filter:
        clauses.append(f"u.status=${idx}"); params.append(status_filter); idx += 1
    where = " AND ".join(clauses) if clauses else "1=1"
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            f"""SELECT u.username, u.nickname, u.account_type, u.status,
                       u.tenant_id, u.last_login_at, u.created_at, t.company_name
                FROM users u LEFT JOIN tenants t ON u.tenant_id = t.tenant_id
                WHERE {where} ORDER BY u.created_at DESC LIMIT 200""", *params)
    return {"code": 0, "data": [{
        "username": r["username"], "nickname": r["nickname"],
        "account_type": r["account_type"], "status": r["status"],
        "tenant_id": r["tenant_id"], "company_name": r["company_name"],
        "last_login": str(r["last_login_at"]) if r["last_login_at"] else "从未",
        "created_at": str(r["created_at"]),
    } for r in rows]}


# ==================== 用户会话查看 ====================

@router.get("/user-sessions/{username}")
async def view_user_sessions(username: str, admin: dict = Depends(get_admin_user), limit: int = Query(20)):
    require_super_admin(admin)
    user_code = f"u_{username}"
    async with database.pool.acquire() as conn:
        sessions = await conn.fetch(
            "SELECT session_id, title, message_count, created_at, updated_at FROM chat_sessions WHERE invite_code=$1 ORDER BY updated_at DESC LIMIT $2",
            user_code, limit)
    return {"code": 0, "data": [{
        "session_id": s["session_id"], "title": s["title"],
        "message_count": s["message_count"], "created_at": str(s["created_at"]),
        "last_active": str(s["updated_at"]),
    } for s in sessions]}


# ==================== 超管进入租户后台 (Impersonate) ====================

@router.post("/impersonate/{tenant_id}")
async def impersonate_tenant(tenant_id: str, admin: dict = Depends(get_admin_user)):
    """超管一键进入指定租户后台"""
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        tenant = await conn.fetchrow(
            "SELECT tenant_id, company_name, industry, status FROM tenants WHERE tenant_id=$1",
            tenant_id,
        )
        if not tenant:
            raise HTTPException(status_code=404, detail="租户不存在")
        if tenant["status"] != "active":
            raise HTTPException(status_code=400, detail=f"租户状态为 {tenant['status']}，不可进入")
    return {
        "code": 0,
        "data": {
            "tenant_id": tenant["tenant_id"],
            "company_name": tenant["company_name"],
            "industry": tenant["industry"],
        },
        "msg": f"已进入租户：{tenant['company_name']}",
    }


# ==================== 平台统计 ====================

@router.get("/stats")
async def platform_stats(admin: dict = Depends(get_admin_user)):
    require_super_admin(admin)
    async with database.pool.acquire() as conn:
        total_users = await conn.fetchval("SELECT count(*) FROM users")
        active_users = await conn.fetchval("SELECT count(*) FROM users WHERE status='active'")
        pending_users = await conn.fetchval("SELECT count(*) FROM users WHERE status='pending'")
        total_tenants = await conn.fetchval("SELECT count(*) FROM tenants")
        pending_tenants = await conn.fetchval("SELECT count(*) FROM tenants WHERE status='pending'")
        total_sessions = await conn.fetchval("SELECT count(*) FROM chat_sessions")
        total_messages = await conn.fetchval("SELECT count(*) FROM chat_messages")
        today_msgs = await conn.fetchval("SELECT count(*) FROM chat_messages WHERE created_at >= CURRENT_DATE")
        pend_fb = await conn.fetchval("SELECT count(*) FROM platform_feedback WHERE status='pending'")
        feat_req = await conn.fetchval("SELECT count(*) FROM platform_feedback WHERE type='feature_request' AND status='pending'")
    return {"code": 0, "data": {
        "users": {"total": total_users, "active": active_users, "pending": pending_users},
        "tenants": {"total": total_tenants, "pending": pending_tenants},
        "chat": {"total_sessions": total_sessions, "total_messages": total_messages, "today_messages": today_msgs or 0},
        "feedback": {"pending": pend_fb or 0, "feature_requests": feat_req or 0},
    }}
