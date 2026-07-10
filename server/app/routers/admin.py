"""灵境平台 - 管理后台API"""
import json
import secrets
import string
import socket
import logging
import bcrypt
from fastapi import APIRouter, Header, HTTPException, Depends, UploadFile, File, Form, Query
from pydantic import BaseModel
from pathlib import Path
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
logger = logging.getLogger("lingjing.admin")

_APK_DIR = Path(__file__).resolve().parent.parent.parent.parent / "app"


# ── 审计日志辅助 ─────────────────────────────────────

async def log_admin_action(
    admin: dict,
    action: str,
    target_type: str = "",
    target_id: str = "",
    detail: str = "",
    conn=None,
):
    """记录管理员操作到审计日志"""
    ip = ""
    try:
        ip = socket.gethostbyname(socket.gethostname())
    except Exception:
        logger.warning("获取本机IP失败", exc_info=True)
    sql = """INSERT INTO admin_audit_logs 
               (admin_id, admin_name, action, target_type, target_id, detail, ip_address)
               VALUES ($1, $2, $3, $4, $5, $6, $7)"""
    if conn:
        await conn.execute(sql, admin["id"], admin.get("nickname", admin.get("username", "")),
                           action, target_type, target_id, detail[:500], ip)
    else:
        async with database.pool.acquire() as c:
            await c.execute(sql, admin["id"], admin.get("nickname", admin.get("username", "")),
                           action, target_type, target_id, detail[:500], ip)


def _to_date(val):
    """字符串 → date 对象，传 None/空字符串返回 None"""
    if val is None or val == "" or val == "null":
        return None
    if isinstance(val, str):
        from datetime import date
        return date.fromisoformat(val[:10])
    return val


# ── 认证 ──────────────────────────────────────────────

async def get_admin_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供管理员认证信息")
    token = authorization[7:]
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, username, nickname, role, status FROM admin_users WHERE token=$1",
            token,
        )
    if not row:
        raise HTTPException(status_code=401, detail="无效的管理员令牌")
    if row["status"] != "active":
        raise HTTPException(status_code=403, detail="管理员账号已被禁用")
    return dict(row)


# ── 数据模型 ──────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class CreateInviteCodeRequest(BaseModel):
    code: str = ""
    nickname: str = ""


# ── 登录 / 密码 ──────────────────────────────────────

@router.post("/login")
async def admin_login(req: AdminLoginRequest):
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, password_hash, nickname, role, token, status FROM admin_users WHERE username=$1",
            req.username.strip(),
        )
    if not row:
        raise HTTPException(status_code=404, detail="管理员账号不存在")
    if row["status"] != "active":
        raise HTTPException(status_code=403, detail="管理员账号已被禁用")
    if not bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="密码错误")

    token = row["token"] or secrets.token_urlsafe(48)
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE admin_users SET token=$1, last_login_at=NOW() WHERE id=$2",
            token, row["id"],
        )
        # 记录登录审计日志
        await log_admin_action(
            {"id": row["id"], "nickname": row["nickname"]},
            "管理员登录", "admin_user", str(row["id"]), "",
            conn,
        )
    return {
        "code": 0,
        "token": token,
        "nickname": row["nickname"],
        "role": row["role"],
        "msg": "登录成功",
    }


@router.get("/check-session")
async def admin_check_session(admin: dict = Depends(get_admin_user)):
    """校验当前会话是否有效"""
    return {"code": 0, "nickname": admin["nickname"], "role": admin["role"]}


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    admin: dict = Depends(get_admin_user),
):
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT password_hash FROM admin_users WHERE id=$1", admin["id"],
        )
    if not bcrypt.checkpw(req.old_password.encode(), row["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="旧密码错误")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=422, detail="新密码至少需要6个字符")

    new_hash = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    new_token = secrets.token_urlsafe(48)
    async with database.pool.acquire() as conn:
        await conn.execute(
            "UPDATE admin_users SET password_hash=$1, token=$2 WHERE id=$3",
            new_hash, new_token, admin["id"],
        )
    await log_admin_action(admin, "修改密码", "admin_user", str(admin["id"]), "")
    return {"code": 0, "token": new_token, "msg": "密码修改成功，请使用新令牌"}


# ── 仪表板 ────────────────────────────────────────────

@router.get("/dashboard")
async def dashboard(admin: dict = Depends(get_admin_user)):
    async with database.pool.acquire() as conn:
        reg_total = await conn.fetchval("SELECT count(*) FROM users")
        reg_active = await conn.fetchval(
            "SELECT count(*) FROM users WHERE status='active'"
        )
        total_tenants = await conn.fetchval("SELECT count(*) FROM tenants")
        active_tenants = await conn.fetchval(
            "SELECT count(*) FROM tenants WHERE status='active'"
        )
        total_sessions = await conn.fetchval(
            "SELECT count(*) FROM chat_sessions"
        ) or 0
        total_versions = await conn.fetchval(
            "SELECT count(*) FROM app_versions"
        ) or 0

        # 最近操作记录
        recent = await conn.fetch(
            """SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 10"""
        )

    return {
        "code": 0,
        "data": {
            "total_users": reg_total,
            "active_users": reg_active,
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "total_sessions": total_sessions,
            "total_versions": total_versions,
            "recent_activities": [dict(r) for r in recent],
        },
    }


# ── 用户管理 ──────────────────────────────────────────

@router.get("/users/invite-codes")
async def list_invite_users(
    status: str = None,
    admin: dict = Depends(get_admin_user),
):
    q = "SELECT id, code, nickname, status, token IS NOT NULL as has_token, created_at, activated_at FROM invite_codes"
    args = []
    if status:
        q += " WHERE status=$1"
        args.append(status)
    q += " ORDER BY id"
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(q, *args)
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.get("/users/registered")
async def list_registered_users(
    status: str = None,
    admin: dict = Depends(get_admin_user),
):
    q = "SELECT id, username, nickname, status, created_at, last_login_at FROM users"
    args = []
    if status:
        q += " WHERE status=$1"
        args.append(status)
    q += " ORDER BY id"
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(q, *args)
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.post("/users/{user_type}/{user_id}/toggle")
async def toggle_user(
    user_type: str,
    user_id: int,
    admin: dict = Depends(get_admin_user),
):
    if user_type == "invite":
        table, id_col = "invite_codes", "id"
    elif user_type == "registered":
        table, id_col = "users", "id"
    else:
        raise HTTPException(status_code=400, detail="无效的用户类型")

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT {id_col}, status FROM {table} WHERE {id_col}=$1", user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="用户不存在")
        current = row["status"]
        if current in ("active", "unused"):
            new_status = "disabled"
        else:
            new_status = "active"
        await conn.execute(
            f"UPDATE {table} SET status=$1, token=CASE WHEN $1='disabled' THEN NULL ELSE token END WHERE {id_col}=$2",
            new_status, user_id,
        )
    await log_admin_action(admin, f"{'禁用' if new_status == 'disabled' else '启用'}{user_type}",
                          f"user_{user_type}", str(user_id), f"状态: {current} → {new_status}")
    return {"code": 0, "new_status": new_status, "msg": f"已{'禁用' if new_status == 'disabled' else '启用'}"}


# ── 邀请码管理 ────────────────────────────────────────

@router.post("/invite-codes")
async def create_invite_code(
    req: CreateInviteCodeRequest,
    admin: dict = Depends(get_admin_user),
):
    code = req.code.strip()
    if not code:
        code = "LJ" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    nickname = req.nickname.strip() or ""

    async with database.pool.acquire() as conn:
        existing = await conn.fetchval("SELECT id FROM invite_codes WHERE code=$1", code)
        if existing:
            raise HTTPException(status_code=409, detail="邀请码已存在")
        await conn.execute(
            "INSERT INTO invite_codes (code, nickname, status) VALUES ($1, $2, 'unused')",
            code, nickname,
        )
    await log_admin_action(admin, "创建邀请码", "invite_code", code, f"昵称: {nickname}")
    return {"code": 0, "invite_code": code, "msg": "邀请码创建成功"}


@router.delete("/invite-codes/{code_id}")
async def delete_invite_code(
    code_id: int,
    admin: dict = Depends(get_admin_user),
):
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, status, code FROM invite_codes WHERE id=$1", code_id)
        if not row:
            raise HTTPException(status_code=404, detail="邀请码不存在")
        if row["status"] == "unused":
            await conn.execute("DELETE FROM invite_codes WHERE id=$1", code_id)
            await log_admin_action(admin, "删除邀请码", "invite_code", row["code"], "已删除", conn)
            return {"code": 0, "msg": "邀请码已删除"}
        else:
            await conn.execute(
                "UPDATE invite_codes SET status='disabled', token=NULL WHERE id=$1", code_id,
            )
            await log_admin_action(admin, "禁用邀请码", "invite_code", row["code"], f"状态: {row['status']}→disabled", conn)
            return {"code": 0, "msg": "邀请码已禁用"}


# ── APP版本管理 ───────────────────────────────────────

@router.get("/app-versions")
async def list_versions(admin: dict = Depends(get_admin_user)):
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM app_versions ORDER BY version_code DESC"
        )
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.post("/app-versions")
async def upload_version(
    version_name: str = Form(...),
    version_code: int = Form(...),
    release_notes: str = Form(""),
    is_force_update: bool = Form(False),
    file: UploadFile = File(...),
    admin: dict = Depends(get_admin_user),
):
    async with database.pool.acquire() as conn:
        existing = await conn.fetchval(
            "SELECT id FROM app_versions WHERE version_code=$1", version_code,
        )
        if existing:
            raise HTTPException(status_code=409, detail="该版本号已存在")

    # 使用英文名保持与CDN/OSS一致（阿里云OSS对中文名支持不友好）
    filename = f"lingjing-{version_name}.apk"
    filepath = _APK_DIR / filename
    size = 0
    with open(filepath, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
            size += len(chunk)

    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO app_versions (version_name, version_code, release_notes,
               apk_filename, apk_size, is_force_update, uploaded_by, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_review')""",
            version_name, version_code, release_notes, filename, size,
            is_force_update, admin["username"],
        )
    await log_admin_action(admin, "上传版本", "app_version", version_name,
                          f"版本码: {version_code}, 大小: {size/1024/1024:.1f}MB")
    return {"code": 0, "msg": f"版本 {version_name} 上传成功，状态：待审核。需在管理后台审核通过后用户才能收到更新。", "size": size}


@router.post("/app-versions/{ver_id}/publish")
async def publish_version(
    ver_id: int,
    admin: dict = Depends(get_admin_user),
):
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, status, version_name FROM app_versions WHERE id=$1", ver_id)
        if not row:
            raise HTTPException(status_code=404, detail="版本不存在")
        await conn.execute(
            "UPDATE app_versions SET status='archived' WHERE status='published'"
        )
        await conn.execute(
            "UPDATE app_versions SET status='published', published_at=NOW() WHERE id=$1",
            ver_id,
        )
    await log_admin_action(admin, "发布版本", "app_version", row["version_name"], "直接发布")
    return {"code": 0, "msg": "版本已发布"}


@router.post("/app-versions/{ver_id}/archive")
async def archive_version(
    ver_id: int,
    admin: dict = Depends(get_admin_user),
):
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT version_name FROM app_versions WHERE id=$1", ver_id)
        if not row:
            raise HTTPException(status_code=404, detail="版本不存在")
        await conn.execute(
            "UPDATE app_versions SET status='archived' WHERE id=$1", ver_id,
        )
    await log_admin_action(admin, "归档版本", "app_version", row["version_name"], "")
    return {"code": 0, "msg": "版本已归档"}


@router.post("/app-versions/{ver_id}/approve")
async def approve_version(
    ver_id: int,
    admin: dict = Depends(get_admin_user),
):
    """审核通过：将待审核版本设为published，同时归档当前published版本"""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, status, version_name FROM app_versions WHERE id=$1", ver_id)
        if not row:
            raise HTTPException(status_code=404, detail="版本不存在")
        if row["status"] != "pending_review":
            raise HTTPException(status_code=400, detail="仅待审核版本可审核通过")
        # 归档当前已发布版本
        await conn.execute(
            "UPDATE app_versions SET status='archived' WHERE status='published'"
        )
        # 审核通过
        await conn.execute(
            "UPDATE app_versions SET status='published', published_at=NOW() WHERE id=$1",
            ver_id,
        )
    await log_admin_action(admin, "审核通过版本", "app_version", row["version_name"], "pending_review→published")
    return {"code": 0, "msg": "版本已审核通过，用户将收到更新提示"}


@router.post("/app-versions/{ver_id}/reject")
async def reject_version(
    ver_id: int,
    admin: dict = Depends(get_admin_user),
):
    """审核驳回：将待审核版本标记为rejected"""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, status, version_name FROM app_versions WHERE id=$1", ver_id)
        if not row:
            raise HTTPException(status_code=404, detail="版本不存在")
        if row["status"] != "pending_review":
            raise HTTPException(status_code=400, detail="仅待审核版本可驳回")
        await conn.execute(
            "UPDATE app_versions SET status='rejected' WHERE id=$1", ver_id,
        )
    await log_admin_action(admin, "驳回版本", "app_version", row["version_name"], "pending_review→rejected")
    return {"code": 0, "msg": "版本已驳回"}


# ── 审计日志查询 ────────────────────────────────────────

@router.get("/audit-logs")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str = Query(None, description="按操作类型筛选"),
    admin_name: str = Query(None, description="按管理员名称搜索"),
    date_from: str = Query(None, description="开始日期 YYYY-MM-DD"),
    date_to: str = Query(None, description="结束日期 YYYY-MM-DD"),
    admin: dict = Depends(get_admin_user),
):
    conditions = []
    args = []
    idx = 1
    if action:
        conditions.append(f"action=${idx}")
        args.append(action)
        idx += 1
    if admin_name:
        conditions.append(f"admin_name ILIKE ${idx}")
        args.append(f"%{admin_name}%")
        idx += 1
    if date_from:
        conditions.append(f"created_at >= ${idx}::date")
        args.append(date_from)
        idx += 1
    if date_to:
        conditions.append(f"created_at < (${idx}::date + INTERVAL '1 day')")
        args.append(date_to)
        idx += 1

    where = " WHERE " + " AND ".join(conditions) if conditions else ""

    async with database.pool.acquire() as conn:
        total = await conn.fetchval(f"SELECT count(*) FROM admin_audit_logs{where}", *args)
        offset = (page - 1) * page_size
        rows = await conn.fetch(
            f"SELECT * FROM admin_audit_logs{where} ORDER BY created_at DESC LIMIT ${idx} OFFSET ${idx+1}",
            *args, page_size, offset,
        )
    return {
        "code": 0,
        "data": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ── 团队邀请码管理（租户管理员用）─────────────────────

class CreateTeamInviteRequest(BaseModel):
    tenant_id: str
    target_role: str = "member"
    max_uses: int = 10
    expires_days: int = 30


@router.post("/team-invite-codes")
async def create_team_invite_code(
    req: CreateTeamInviteRequest,
    admin: dict = Depends(get_admin_user),
):
    """创建团队邀请码"""
    from datetime import datetime, timezone, timedelta

    code = "TJ" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    expires_at = None
    if req.expires_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=req.expires_days)

    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO tenant_invite_codes
               (code, tenant_id, target_role, max_uses, expires_at, created_by)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            code, req.tenant_id, req.target_role, req.max_uses, expires_at,
            admin["username"],
        )
    return {
        "code": 0,
        "invite_code": code,
        "target_role": req.target_role,
        "max_uses": req.max_uses,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "msg": "团队邀请码创建成功",
    }


@router.get("/team-invite-codes")
async def list_team_invite_codes(
    tenant_id: str = None,
    admin: dict = Depends(get_admin_user),
):
    """查看团队邀请码列表"""
    conditions = []
    params = []
    idx = 1
    if tenant_id:
        conditions.append(f"tic.tenant_id=${idx}")
        params.append(tenant_id)
        idx += 1
    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            f"""SELECT tic.*, t.company_name
                FROM tenant_invite_codes tic
                JOIN tenants t ON t.tenant_id = tic.tenant_id
                {where} ORDER BY tic.created_at DESC""",
            *params,
        )
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.delete("/team-invite-codes/{code}")
async def revoke_team_invite_code(
    code: str,
    admin: dict = Depends(get_admin_user),
):
    """作废团队邀请码"""
    async with database.pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE tenant_invite_codes SET status='revoked' WHERE code=$1",
            code,
        )
    if result == "UPDATE 0":
        return {"code": -1, "msg": "邀请码不存在"}
    return {"code": 0, "msg": "邀请码已作废"}


# ── 租户管理 ──────────────────────────────────────────

@router.get("/tenants")
async def list_tenants(
    status: str = None,
    admin: dict = Depends(get_admin_user),
):
    """查看所有租户"""
    q = "SELECT * FROM tenants"
    args = []
    if status:
        q += " WHERE status=$1"
        args.append(status)
    q += " ORDER BY created_at DESC"

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(q, *args)
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.get("/tenants/{tenant_id}/members")
async def list_tenant_members(
    tenant_id: str,
    admin: dict = Depends(get_admin_user),
):
    """查看租户成员"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT u.username, u.nickname, u.status, u.last_login_at,
                      tu.role, tu.created_at AS joined_at
               FROM tenant_users tu
               JOIN users u ON u.username = tu.user_id
               WHERE tu.tenant_id=$1 ORDER BY tu.created_at""",
            tenant_id,
        )
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.put("/tenants/{tenant_id}/members/{username}")
async def update_tenant_member(
    tenant_id: str, username: str, req: dict,
    admin: dict = Depends(get_admin_user),
):
    """超管更新租户成员信息（角色）"""
    if admin.get("role") not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="仅超管可执行此操作")
    async with database.pool.acquire() as conn:
        member = await conn.fetchrow(
            "SELECT tu.id, tu.role, tu.name FROM tenant_users tu WHERE tu.tenant_id=$1 AND tu.user_id=$2",
            tenant_id, username,
        )
        if not member:
            raise HTTPException(status_code=404, detail="成员不存在")
        if member["role"] == "owner":
            raise HTTPException(status_code=400, detail="不能修改租户所有者的角色")
        if "role" in req and req["role"] in ("member", "manager", "admin"):
            await conn.execute(
                "UPDATE tenant_users SET role=$1, updated_at=NOW() WHERE tenant_id=$2 AND user_id=$3",
                req["role"], tenant_id, username,
            )
        if "name" in req and req["name"]:
            await conn.execute(
                "UPDATE tenant_users SET name=$1, updated_at=NOW() WHERE tenant_id=$2 AND user_id=$3",
                req["name"], tenant_id, username,
            )
    return {"code": 0, "msg": "成员信息已更新"}


@router.delete("/tenants/{tenant_id}/members/{username}")
async def remove_tenant_member(
    tenant_id: str, username: str,
    admin: dict = Depends(get_admin_user),
):
    """超管从租户移除成员"""
    if admin.get("role") not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="仅超管可执行此操作")
    async with database.pool.acquire() as conn:
        member = await conn.fetchrow(
            "SELECT tu.id, tu.role FROM tenant_users tu WHERE tu.tenant_id=$1 AND tu.user_id=$2",
            tenant_id, username,
        )
        if not member:
            raise HTTPException(status_code=404, detail="成员不存在")
        if member["role"] == "owner":
            raise HTTPException(status_code=400, detail="不能移除租户所有者")
        await conn.execute("DELETE FROM tenant_users WHERE tenant_id=$1 AND user_id=$2", tenant_id, username)
        await conn.execute("UPDATE users SET tenant_id=NULL WHERE username=$1 AND tenant_id=$2", username, tenant_id)
    return {"code": 0, "msg": "成员已从租户移除"}


# ── 超管模拟租户登录 ──────────────────────────────────

class ImpersonateRequest(BaseModel):
    tenant_id: str

@router.post("/tenants/{tenant_id}/impersonate")
async def impersonate_tenant(
    tenant_id: str,
    admin: dict = Depends(get_admin_user),
):
    """超管模拟登录为租户管理员，获取租户的登录token"""
    if admin.get("role") not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="仅超管可执行此操作")
    
    async with database.pool.acquire() as conn:
        # 查找目标租户
        tenant = await conn.fetchrow(
            "SELECT tenant_id, company_name, status FROM tenants WHERE tenant_id=$1",
            tenant_id,
        )
        if not tenant:
            raise HTTPException(status_code=404, detail=f"租户 {tenant_id} 不存在")
        if tenant["status"] != "active":
            raise HTTPException(status_code=400, detail="租户已禁用，无法模拟登录")
        
        # 查找租户的owner/admin用户
        target_user = await conn.fetchrow(
            """SELECT u.username, u.nickname, u.token, u.status, tu.role
               FROM tenant_users tu
               JOIN users u ON u.username = tu.user_id
               WHERE tu.tenant_id=$1
               ORDER BY CASE tu.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
               LIMIT 1""",
            tenant_id,
        )
        if not target_user:
            raise HTTPException(status_code=404, detail=f"租户 {tenant_id} 下无可用成员（请先在租户中添加管理员或成员）")
        if target_user["status"] != "active":
            raise HTTPException(status_code=400, detail="该租户管理员账号已被禁用")
        
        token = target_user["token"]
        if not token:
            # 如果用户没有token，生成一个新的
            import secrets
            token = secrets.token_urlsafe(48)
            await conn.execute(
                "UPDATE users SET token=$1, token_expires_at=NOW() + interval '24 hours' WHERE username=$2",
                token, target_user["username"],
            )
        
        # 记录审计日志
        await conn.execute(
            """INSERT INTO admin_audit_logs (admin_id, admin_name, action, target_type, target_id, detail, ip_address)
               VALUES ($1, $2, 'impersonate', 'tenant', $3, $4, '0.0.0.0')""",
            admin["id"], admin["nickname"], tenant_id,
            f"模拟登录租户 {tenant['company_name']} 的 {target_user['role']} ({target_user['nickname']})",
        )
    
    return {
        "code": 0,
        "data": {
            "token": token,
            "nickname": target_user["nickname"],
            "username": target_user["username"],
            "role": target_user["role"],
            "tenant_name": tenant["company_name"],
            "tenant_id": tenant_id,
        },
    }


@router.post("/revoke-impersonation")
async def revoke_impersonation(
    admin: dict = Depends(get_admin_user),
):
    """记录撤销模拟登录（审计用）"""
    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO admin_audit_logs (admin_id, admin_name, action, target_type, target_id, detail, ip_address)
               VALUES ($1, $2, 'revoke_impersonation', 'system', '', '撤销模拟登录', '0.0.0.0')""",
            admin["id"], admin["nickname"],
        )
    return {"code": 0, "msg": "模拟登录已撤销"}


# ── 租户详情仪表板 ────────────────────────────────────

@router.get("/tenants/{tenant_id}/dashboard")
async def tenant_dashboard(
    tenant_id: str,
    admin: dict = Depends(get_admin_user),
):
    """租户综合仪表板：成员/项目/客户/供应商/财务/消息/活跃度"""
    async with database.pool.acquire() as conn:
        # 租户基本信息
        tenant = await conn.fetchrow(
            "SELECT * FROM tenants WHERE tenant_id=$1", tenant_id,
        )
        if not tenant:
            raise HTTPException(status_code=404, detail=f"租户 {tenant_id} 不存在")

        # 成员统计
        member_count = await conn.fetchval(
            "SELECT count(*) FROM tenant_users WHERE tenant_id=$1", tenant_id,
        )
        member_roles = await conn.fetch(
            "SELECT role, count(*) as cnt FROM tenant_users WHERE tenant_id=$1 GROUP BY role",
            tenant_id,
        )

        # 获取所有成员的 username 列表
        member_rows = await conn.fetch(
            "SELECT user_id FROM tenant_users WHERE tenant_id=$1", tenant_id,
        )
        usernames = [f"u_{m['user_id']}" for m in member_rows]  # u_username 格式

        # 对话统计
        session_count = 0
        message_count = 0
        today_messages = 0
        active_7d = 0
        if usernames:
            u_params_list = []
            placeholders = []
            for i, u in enumerate(usernames):
                u_params_list.append(u)
                placeholders.append(f"${i+1}")
            ph_str = ",".join(placeholders)
            
            session_count = await conn.fetchval(
                f"SELECT count(*) FROM chat_sessions WHERE invite_code IN ({ph_str})",
                *u_params_list,
            )
            message_count = await conn.fetchval(
                f"""SELECT count(*) FROM chat_messages cm
                    JOIN chat_sessions cs ON cm.session_id = cs.session_id
                    WHERE cs.invite_code IN ({ph_str})""",
                *u_params_list,
            )
            today_messages = await conn.fetchval(
                f"""SELECT count(*) FROM chat_messages cm
                    JOIN chat_sessions cs ON cm.session_id = cs.session_id
                    WHERE cs.invite_code IN ({ph_str})
                    AND cm.created_at >= CURRENT_DATE""",
                *u_params_list,
            )
            active_7d = await conn.fetchval(
                f"""SELECT count(DISTINCT cs.invite_code) FROM chat_messages cm
                    JOIN chat_sessions cs ON cm.session_id = cs.session_id
                    WHERE cs.invite_code IN ({ph_str})
                    AND cm.created_at >= NOW() - INTERVAL '7 days'""",
                *u_params_list,
            )

        # 记忆统计
        memory_count = 0
        if usernames:
            memory_count = await conn.fetchval(
                f"SELECT count(*) FROM memories WHERE partner_id IN ({ph_str})",
                *u_params_list,
            )

        # 待办统计
        todo_active = await conn.fetchval(
            "SELECT count(*) FROM todo_items WHERE tenant_id=$1 AND status='active'",
            tenant_id,
        )

    return {
        "code": 0,
        "data": {
            "tenant": dict(tenant),
            "members": {
                "total": member_count,
                "roles": {r["role"]: r["cnt"] for r in member_roles},
            },
            "chat": {
                "sessions": session_count,
                "messages": message_count,
                "today_messages": today_messages,
                "active_users_7d": active_7d,
            },
            "ai": {
                "memories": memory_count,
                "todos_active": todo_active,
            },
        },
    }


# ── 租户状态管理 ──────────────────────────────────────

class TenantUpdateRequest(BaseModel):
    status: str = None      # active / disabled / suspended
    plan: str = None        # trial / basic / pro / enterprise


@router.put("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    req: TenantUpdateRequest,
    admin: dict = Depends(get_admin_user),
):
    """更新租户状态/套餐"""
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM tenants WHERE tenant_id=$1", tenant_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="租户不存在")

        updates = []
        params = []
        idx = 1
        if req.status is not None:
            updates.append(f"status=${idx}")
            params.append(req.status)
            idx += 1
        if req.plan is not None:
            updates.append(f"plan=${idx}")
            params.append(req.plan)
            idx += 1

        if not updates:
            return {"code": 0, "msg": "无变更"}

        updates.append("updated_at=NOW()")
        params.append(tenant_id)
        await conn.execute(
            f"UPDATE tenants SET {', '.join(updates)} WHERE tenant_id=${idx}",
            *params,
        )
    return {"code": 0, "msg": f"租户已更新: {', '.join(u.split('=')[0] for u in updates[:2])}"}


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    admin: dict = Depends(get_admin_user),
):
    """删除租户（级联清理关联数据）"""
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM tenants WHERE tenant_id=$1", tenant_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="租户不存在")

        # 级联删除顺序（先删FK子表，再删租户）
        tables = [
            "todo_items", "tenant_notifications", "tenant_invite_codes",
            "customer_followups", "supplier_followups",
            "biz_attendance", "biz_finance", "biz_contracts", "biz_processes",
            "biz_quality_inspections", "biz_projects", "biz_customers",
            "biz_suppliers", "biz_supplier_products",
            "ai_alerts", "ai_approvals", "ai_construction_rules", "ai_daily_reports",
            "approval_flows", "approvals",
            "invoices", "documents",
            "notifications",
            "recipes", "template_images",
            "tasks", "projects", "departments",
        ]
        for tbl in tables:
            try:
                await conn.execute(
                    f"DELETE FROM {tbl} WHERE tenant_id=$1", tenant_id,
                )
            except Exception:
                logger.warning(f"删除租户数据时表不存在或失败: {tbl}", exc_info=True)
                pass  # 表可能不存在

        # 清除用户关联
        await conn.execute(
            "UPDATE users SET tenant_id=NULL, status='inactive' WHERE tenant_id=$1",
            tenant_id,
        )
        # 删租户成员
        await conn.execute(
            "DELETE FROM tenant_users WHERE tenant_id=$1", tenant_id,
        )
        # 删租户
        await conn.execute(
            "DELETE FROM tenants WHERE tenant_id=$1", tenant_id,
        )

    return {"code": 0, "msg": f"租户 {tenant_id} 已删除及所有关联数据"}


# ── 租户业务数据穿透 ──────────────────────────────────

@router.get("/tenants/{tenant_id}/sessions")
async def tenant_chat_sessions(
    tenant_id: str,
    page: int = 1,
    page_size: int = 20,
    admin: dict = Depends(get_admin_user),
):
    """查看租户的对话会话列表"""
    async with database.pool.acquire() as conn:
        member_rows = await conn.fetch(
            "SELECT user_id FROM tenant_users WHERE tenant_id=$1", tenant_id,
        )
        usernames = [f"u_{m['user_id']}" for m in member_rows]
        if not usernames:
            return {"code": 0, "data": [], "total": 0}

        ph = ",".join(f"${i+1}" for i in range(len(usernames)))

        total = await conn.fetchval(
            f"SELECT count(*) FROM chat_sessions WHERE invite_code IN ({ph})",
            *usernames,
        )
        rows = await conn.fetch(
            f"""SELECT cs.session_id, cs.title, cs.invite_code, cs.message_count,
                       cs.created_at, cs.updated_at,
                       (SELECT content FROM chat_messages WHERE session_id=cs.session_id
                        ORDER BY created_at DESC LIMIT 1) as last_message
                FROM chat_sessions cs
                WHERE cs.invite_code IN ({ph})
                ORDER BY cs.updated_at DESC
                LIMIT {page_size} OFFSET {(page-1)*page_size}""",
            *usernames,
        )

    return {
        "code": 0,
        "data": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ── 对话管理 ──────────────────────────────────────────

@router.get("/chat/sessions")
async def list_chat_sessions(
    page: int = 1,
    page_size: int = 20,
    keyword: str = "",
    admin: dict = Depends(get_admin_user),
):
    """查看所有对话会话列表（支持搜索）"""
    offset = (page - 1) * page_size

    where_parts = []
    args = []
    idx = 1

    if keyword:
        where_parts.append(
            f"""(cs.title ILIKE ${idx} OR cs.invite_code ILIKE ${idx}
             OR EXISTS (SELECT 1 FROM chat_messages cm2
                        WHERE cm2.session_id = cs.session_id AND cm2.content ILIKE ${idx}))"""
        )
        args.append(f"%{keyword}%")
        idx += 1

    where_clause = " AND ".join(where_parts)
    if where_clause:
        where_clause = "WHERE " + where_clause

    count_q = f"""SELECT COUNT(*) FROM chat_sessions cs {where_clause}"""

    query = f"""
        SELECT cs.session_id, cs.invite_code, cs.title, cs.message_count,
               cs.created_at, cs.updated_at, cs.tenant_id,
               (SELECT content FROM chat_messages cm
                WHERE cm.session_id = cs.session_id AND cm.role = 'user'
                ORDER BY cm.created_at DESC LIMIT 1) AS last_user_msg,
               (SELECT content FROM chat_messages cm
                WHERE cm.session_id = cs.session_id AND cm.role = 'assistant'
                ORDER BY cm.created_at DESC LIMIT 1) AS last_ai_msg,
               (SELECT SUM(tokens_input + tokens_output) FROM chat_messages cm
                WHERE cm.session_id = cs.session_id) AS total_tokens,
               (SELECT SUM(cost_yuan) FROM chat_messages cm
                WHERE cm.session_id = cs.session_id) AS total_cost
        FROM chat_sessions cs
        {where_clause}
        ORDER BY cs.updated_at DESC
        LIMIT {page_size} OFFSET {offset}
    """

    async with database.pool.acquire() as conn:
        total = await conn.fetchval(count_q, *args)
        rows = await conn.fetch(query, *args)

    sessions = []
    for r in rows:
        sessions.append({
            "session_id": r["session_id"],
            "invite_code": r["invite_code"],
            "title": r["title"] or "新对话",
            "message_count": r["message_count"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
            "tenant_id": r["tenant_id"],
            "last_user_msg": (r["last_user_msg"] or "")[:100],
            "last_ai_msg": (r["last_ai_msg"] or "")[:100],
            "total_tokens": r["total_tokens"] or 0,
            "total_cost": round(float(r["total_cost"] or 0), 6),
        })

    return {
        "code": 0,
        "data": sessions,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/chat/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    admin: dict = Depends(get_admin_user),
):
    """查看某个会话的完整消息记录"""
    async with database.pool.acquire() as conn:
        session = await conn.fetchrow(
            """SELECT session_id, invite_code, title, message_count, created_at, updated_at
               FROM chat_sessions WHERE session_id = $1""",
            session_id,
        )
        if not session:
            return {"code": 404, "detail": "会话不存在"}

        rows = await conn.fetch(
            """SELECT id, role, content, tokens_input, tokens_output, cost_yuan,
                      model_used, created_at, attachments
               FROM chat_messages
               WHERE session_id = $1
               ORDER BY created_at ASC""",
            session_id,
        )

    messages = []
    for r in rows:
        messages.append({
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "tokens_input": r["tokens_input"] or 0,
            "tokens_output": r["tokens_output"] or 0,
            "cost_yuan": round(float(r["cost_yuan"] or 0), 6),
            "model_used": r["model_used"] or "",
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "attachments": r["attachments"],
        })

    return {
        "code": 0,
        "session": {
            "session_id": session["session_id"],
            "invite_code": session["invite_code"],
            "title": session["title"] or "新对话",
            "message_count": session["message_count"],
            "created_at": session["created_at"].isoformat() if session["created_at"] else None,
            "updated_at": session["updated_at"].isoformat() if session["updated_at"] else None,
        },
        "messages": messages,
    }


# ── WebSocket 推送管理 ───────────────────────────────

@router.get("/ws/online")
async def ws_online(admin: dict = Depends(get_admin_user)):
    """查看 WebSocket 在线状态和用户列表"""
    from services.ws_manager import ConnectionManager
    count = ConnectionManager.online_count()
    users = ConnectionManager.list_online()
    total = sum(ConnectionManager.device_count(u) for u in users)
    return {"code": 0, "online_count": count, "total_devices": total, "online_users": users, "note": "多设备支持已启用"}

@router.get("/ws/online-detail")
async def ws_online_detail(admin: dict = Depends(get_admin_user)):
    """查看 WebSocket 在线详情（含各用户设备数）"""
    from services.ws_manager import ConnectionManager
    users = ConnectionManager.list_online()
    detail = {u: ConnectionManager.device_count(u) for u in users}
    return {"code": 0, "online_users": users, "devices": detail}


class TestPushRequest(BaseModel):
    user_id: str
    title: str = "🧪 测试推送"
    content: str = "这是一条来自管理后台的测试推送"

@router.post("/ws/test-push")
async def ws_test_push(req: TestPushRequest, admin: dict = Depends(get_admin_user)):
    """向指定用户发送 WebSocket 测试推送"""
    from services.push_service import push_to_user
    ok = await push_to_user(req.user_id, req.title, req.content)
    if ok:
        return {"code": 0, "msg": f"推送已发送到 {req.user_id}", "user_online": True}
    else:
        return {"code": 0, "msg": f"用户 {req.user_id} 当前不在线，推送未送达", "user_online": False}



# ── 自动化任务管理（管理后台） ──────────────────────────

class AdminAutomationCreate(BaseModel):
    name: str = ""
    task_type: str = "custom"
    cron_expr: str = ""
    description_nl: str = ""


@router.get("/automation/tasks")
async def admin_list_automation_tasks(
    admin: dict = Depends(get_admin_user),
):
    """管理后台 - 自动化任务列表"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM automated_tasks ORDER BY created_at DESC"
        )
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.post("/automation/tasks")
async def admin_create_automation_task(
    req: AdminAutomationCreate,
    admin: dict = Depends(get_admin_user),
):
    """管理后台 - 创建自动化任务"""
    async with database.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO automated_tasks (tenant_id, name, task_type, cron_expr, description_nl, is_enabled, created_at, updated_at)
            VALUES ('admin', $1, $2, $3, $4, TRUE, NOW(), NOW())
        """,
            req.name or "未命名任务",
            req.task_type or "custom",
            req.cron_expr or "",
            req.description_nl or "",
        )
    return {"code": 0, "msg": "自动化任务已创建"}


@router.put("/automation/tasks/{task_id}")
async def admin_update_automation_task(
    task_id: int,
    req: dict,
    admin: dict = Depends(get_admin_user),
):
    """管理后台 - 更新自动化任务"""
    valid_fields = {"name", "task_type", "cron_expr", "description_nl", "is_enabled"}
    fields = []
    params = []
    idx = 1
    for field in valid_fields:
        if field in req:
            fields.append(f"{field}=${idx}")
            params.append(req[field])
            idx += 1
    if not fields:
        raise HTTPException(status_code=400, detail="没有要更新的字段")
    params.append(task_id)
    async with database.pool.acquire() as conn:
        await conn.execute(
            f"UPDATE automated_tasks SET {', '.join(fields)}, updated_at=NOW() WHERE id=${idx}",
            *params,
        )
    return {"code": 0, "msg": "自动化任务已更新"}


@router.post("/automation/tasks/{task_id}/trigger")
async def admin_trigger_automation_task(
    task_id: int,
    admin: dict = Depends(get_admin_user),
):
    """管理后台 - 手动触发自动化任务"""
    async with database.pool.acquire() as conn:
        task = await conn.fetchrow("SELECT * FROM automated_tasks WHERE id=$1", task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        # 标记触发时间
        await conn.execute(
            "UPDATE automated_tasks SET last_run_at=NOW() WHERE id=$1", task_id
        )
    return {"code": 0, "msg": f"任务已触发: {task['name']}"}


@router.delete("/automation/tasks/{task_id}")
async def admin_delete_automation_task(
    task_id: int,
    admin: dict = Depends(get_admin_user),
):
    """管理后台 - 删除自动化任务"""
    async with database.pool.acquire() as conn:
        await conn.execute("DELETE FROM automated_tasks WHERE id=$1", task_id)
    return {"code": 0, "msg": "自动化任务已删除"}


@router.post("/automation/parse")
async def admin_parse_automation_prompt(
    req: dict,
    admin: dict = Depends(get_admin_user),
):
    """管理后台 - 智能解析自然语言任务描述"""
    prompt = req.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="请输入任务描述")
    # 简单关键词解析
    result = {"name": "", "task_type": "", "cron_expression": "", "description": ""}
    pl = prompt.lower()
    if "考勤" in pl or "出勤" in pl:
        result["task_type"] = "attendance_report"
        result["name"] = "考勤报告"
    elif "财务" in pl or "费用" in pl or "金额" in pl:
        result["task_type"] = "finance_summary"
        result["name"] = "财务汇总"
    elif "质量" in pl or "质检" in pl:
        result["task_type"] = "quality_alert"
        result["name"] = "质量预警"
    elif "进度" in pl:
        result["task_type"] = "progress_reminder"
        result["name"] = "进度提醒"
    elif "签到" in pl:
        result["task_type"] = "checkin_reminder"
        result["name"] = "签到提醒"
    elif "逾期" in pl or "到期" in pl:
        result["task_type"] = "task_overdue_report"
        result["name"] = "逾期任务报告"
    elif "项目" in pl and ("汇总" in pl or "总结" in pl):
        result["task_type"] = "project_summary"
        result["name"] = "项目汇总"
    elif "工人" in pl:
        result["task_type"] = "worker_count_report"
        result["name"] = "工人统计报告"
    elif "日程" in pl or "安排" in pl:
        result["task_type"] = "schedule_reminder"
        result["name"] = "日程提醒"
    else:
        result["task_type"] = "custom"
        result["name"] = "自定义任务"

    # cron 推断
    if "早" in pl or "上午" in pl: result["cron_expression"] = "0 8 * * *"
    elif "晚" in pl or "下午" in pl: result["cron_expression"] = "0 18 * * *"
    elif "午" in pl: result["cron_expression"] = "0 12 * * *"
    elif "周" in pl: result["cron_expression"] = "0 9 * * 1"
    elif "月" in pl: result["cron_expression"] = "0 0 1 * *"
    else: result["cron_expression"] = "0 8 * * *"

    result["description"] = f"解析结果：类型={result['task_type']}，定时={result['cron_expression']}"
    return {"code": 0, "data": result}
