"""灵境平台 - 租户管理员API（APP后台）"""
import secrets
import string
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from .auth import get_current_user

router = APIRouter(prefix="/api/v1/tenant-admin", tags=["tenant-admin"])


def require_tenant_admin(user: dict):
    """校验当前用户是否是租户管理员"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=403, detail="非企业用户，无权访问")
    if user.get("tenant_role") not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="非管理员，无权访问")
    return user


# ── 团队信息 ──────────────────────────────────────────

@router.get("/team-info")
async def get_team_info(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]

    async with database.pool.acquire() as conn:
        tenant = await conn.fetchrow(
            "SELECT * FROM tenants WHERE tenant_id=$1", tenant_id,
        )
        members = await conn.fetch(
            """SELECT tu.user_id, tu.name, tu.phone, tu.role, tu.ext_data, tu.created_at,
                      u.status, u.last_login_at
               FROM tenant_users tu
               LEFT JOIN users u ON u.username = tu.user_id
               WHERE tu.tenant_id=$1 ORDER BY tu.created_at""",
            tenant_id,
        )

    if not tenant:
        raise HTTPException(status_code=404, detail="租户不存在")

    return {
        "code": 0,
        "data": {
            "company_name": tenant["company_name"],
            "industry": tenant["industry"],
            "owner_name": tenant["owner_name"],
            "owner_phone": tenant.get("owner_phone", ""),
            "plan": tenant.get("plan", "free"),
            "status": tenant["status"],
            "created_at": str(tenant["created_at"]),
            "members": [
                {
                    "user_id": m["user_id"],
                    "name": m["name"],
                    "phone": m["phone"] or "",
                    "role": m["role"],
                    "ext_data": m["ext_data"] if m["ext_data"] else {},
                    "status": m["status"] or "unknown",
                    "joined_at": str(m["created_at"]) if m["created_at"] else "",
                    "last_login": str(m["last_login_at"]) if m["last_login_at"] else "从未",
                }
                for m in members
            ],
        },
    }


# ── 邀请码管理 ────────────────────────────────────────

class CreateTeamInviteRequest(BaseModel):
    target_role: str = "member"
    max_uses: int = 10
    expires_days: int = 30


@router.post("/invite-codes")
async def create_invite_code(
    req: CreateTeamInviteRequest = CreateTeamInviteRequest(),
    user: dict = Depends(get_current_user),
):
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]

    code = "TJ" + "".join(
        secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6)
    )
    expires_at = None
    if req.expires_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=req.expires_days)

    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO tenant_invite_codes
               (code, tenant_id, target_role, max_uses, expires_at, created_by)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            code, tenant_id, req.target_role, req.max_uses, expires_at,
            admin["nickname"],
        )
    return {
        "code": 0,
        "invite_code": code,
        "target_role": req.target_role,
        "max_uses": req.max_uses,
        "msg": "团队邀请码创建成功",
    }


@router.get("/invite-codes")
async def list_invite_codes(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, code, target_role, max_uses, used_count, status,
                      created_by, created_at, expires_at, used_by
               FROM tenant_invite_codes
               WHERE tenant_id=$1 ORDER BY created_at DESC""",
            tenant_id,
        )
    return {
        "code": 0,
        "data": [
            {
                "id": r["id"],
                "code": r["code"],
                "target_role": r["target_role"],
                "max_uses": r["max_uses"],
                "used_count": r["used_count"],
                "status": r["status"],
                "created_by": r["created_by"],
                "created_at": str(r["created_at"]),
                "expires_at": str(r["expires_at"]) if r["expires_at"] else "永不过期",
                "used_by": json.loads(r["used_by"]) if isinstance(r["used_by"], str) else (r["used_by"] or []),
            }
            for r in rows
        ],
    }


# ── 数据看板 ──────────────────────────────────────────

@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]

    async with database.pool.acquire() as conn:
        # 团队成员数
        member_count = await conn.fetchval(
            "SELECT count(*) FROM tenant_users WHERE tenant_id=$1", tenant_id,
        )
        # 团队邀请码统计
        invite_total = await conn.fetchval(
            "SELECT count(*) FROM tenant_invite_codes WHERE tenant_id=$1", tenant_id,
        )
        invite_active = await conn.fetchval(
            "SELECT count(*) FROM tenant_invite_codes WHERE tenant_id=$1 AND status='active'",
            tenant_id,
        )
        # 获取团队所有成员的 username
        member_usernames = await conn.fetch(
            "SELECT user_id FROM tenant_users WHERE tenant_id=$1", tenant_id,
        )
        usernames = [m["user_id"] for m in member_usernames]

        total_messages = 0
        today_messages = 0
        total_sessions = 0
        if usernames:
            # 获取所有成员的会话
            placeholders = ", ".join(f"'u_{u}'" for u in usernames)
            total_sessions = await conn.fetchval(
                f"SELECT count(*) FROM chat_sessions WHERE invite_code IN ({placeholders})"
            )
            total_messages = await conn.fetchval(
                f"""SELECT count(*) FROM chat_messages cm
                    JOIN chat_sessions cs ON cm.session_id = cs.session_id
                    WHERE cs.invite_code IN ({placeholders})"""
            )
            today_messages = await conn.fetchval(
                f"""SELECT count(*) FROM chat_messages cm
                    JOIN chat_sessions cs ON cm.session_id = cs.session_id
                    WHERE cs.invite_code IN ({placeholders})
                    AND cm.created_at >= CURRENT_DATE"""
            )

    return {
        "code": 0,
        "data": {
            "team": {
                "member_count": member_count,
                "invite_total": invite_total,
                "invite_active": invite_active,
            },
            "chat": {
                "total_sessions": total_sessions,
                "total_messages": total_messages,
                "today_messages": today_messages,
            },
        },
    }


# ── 配方 & 样板（租户内） ────────────────────────────

@router.get("/recipes")
async def list_tenant_recipes(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, tenant_id, name, description, ingredients, steps,
                      category, status, created_by, created_at, updated_at
               FROM recipes WHERE tenant_id=$1 AND status='active'
               ORDER BY updated_at DESC""",
            tenant_id,
        )
    return {
        "code": 0,
        "data": [
            {
                "id": r["id"],
                "tenant_id": r["tenant_id"],
                "name": r["name"],
                "description": r["description"],
                "ingredients": json.loads(r["ingredients"]) if isinstance(r["ingredients"], str) else (r["ingredients"] or []),
                "steps": json.loads(r["steps"]) if isinstance(r["steps"], str) else (r["steps"] or []),
                "category": r["category"],
                "status": r["status"],
                "created_by": r["created_by"],
                "created_at": str(r["created_at"]),
                "updated_at": str(r["updated_at"]) if r["updated_at"] else "",
            }
            for r in rows
        ],
    }


@router.get("/samples")
async def list_tenant_samples(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT sr.id, sr.tenant_id, sr.customer_name as name,
                      sr.notes as description,
                      sr.image_url, sr.status as category,
                      sr.file_ids, sr.project_name, sr.recipe_name,
                      sr.created_by, sr.created_at, sr.updated_at,
                      tu.name as creator_name
               FROM sample_records sr
               LEFT JOIN tenant_users tu ON tu.user_id = sr.created_by AND tu.tenant_id = sr.tenant_id
               WHERE sr.tenant_id=$1
               ORDER BY sr.updated_at DESC""",
            tenant_id,
        )
    return {
        "code": 0,
        "data": [
            {
                "id": r["id"],
                "tenant_id": r["tenant_id"],
                "name": r["name"] or r["recipe_name"] or f"样板#{r['id']}",
                "description": r["description"] or "",
                "image_url": r["image_url"] or "",
                "category": r["category"] or "drafted",
                "project_name": r["project_name"] or "",
                "recipe_name": r["recipe_name"] or "",
                "file_ids": r["file_ids"] if isinstance(r["file_ids"], (list, str)) else [],
                "created_by": r["creator_name"] or r["created_by"] or "",
                "created_at": str(r["created_at"]),
                "updated_at": str(r["updated_at"]) if r["updated_at"] else "",
            }
            for r in rows
        ],
        "total": len(rows),
    }


@router.post("/samples")
async def create_tenant_sample(req: dict, user: dict = Depends(get_current_user)):
    """租户管理员 - 创建样板记录"""
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO sample_records
               (tenant_id, project_id, project_name, customer_name, recipe_name,
                notes, image_url, file_ids, status, phase, created_by, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
               RETURNING id""",
            tenant_id,
            req.get("project_id"),
            req.get("project_name", ""),
            req.get("customer_name", ""),
            req.get("recipe_name", ""),
            req.get("notes", ""),
            req.get("image_url", ""),
            json.dumps(req.get("file_ids", []), ensure_ascii=False) if req.get("file_ids") else '[]',
            req.get("status", "drafted"),
            req.get("phase", ""),
            req.get("created_by", user.get("code", "")),
        )
    return {"code": 0, "msg": "样板已创建", "id": row["id"]}


@router.delete("/samples/{sample_id}")
async def delete_tenant_sample(sample_id: int, user: dict = Depends(get_current_user)):
    """租户管理员 - 删除样板"""
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM sample_records WHERE id=$1 AND tenant_id=$2",
            sample_id, admin["tenant_id"],
        )
    return {"code": 0, "msg": "样板已删除"}


@router.put("/samples/{sample_id}")
async def update_tenant_sample(sample_id: int, req: dict, user: dict = Depends(get_current_user)):
    """租户管理员 - 更新样板"""
    admin = require_tenant_admin(user)
    valid = ["project_name","customer_name","recipe_name","notes","image_url","file_ids","status","phase","specification","formula"]
    fields = []
    params = []
    for f in valid:
        if f in req:
            val = req[f]
            if f == "file_ids" and isinstance(val, list):
                val = json.dumps(val, ensure_ascii=False)
            fields.append(f"{f}=${len(params)+1}")
            params.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="没有要更新的字段")
    params.append(sample_id)
    params.append(admin["tenant_id"])
    async with database.pool.acquire() as conn:
        result = await conn.execute(
            f"UPDATE sample_records SET {', '.join(fields)}, updated_at=NOW() WHERE id=${len(params)-1} AND tenant_id=${len(params)}",
            *params)
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="样板不存在或无权操作")
    return {"code": 0, "msg": "样板已更新"}


# ── 配方 CRUD（租户管理员） ──────────────────────────

@router.post("/recipes")
async def create_tenant_recipe(req: dict, user: dict = Depends(get_current_user)):
    """租户管理员 - 创建配方"""
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO recipes (tenant_id, name, description, ingredients, steps,
               category, status, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, NOW(), NOW())
               RETURNING id""",
            tenant_id,
            req.get("name", ""),
            req.get("description", ""),
            json.dumps(req.get("ingredients", []), ensure_ascii=False),
            json.dumps(req.get("steps", []), ensure_ascii=False),
            req.get("category", ""),
            req.get("status", "active"),
            user.get("user_id"),
        )
    return {"code": 0, "msg": "配方已创建", "id": row["id"]}


@router.put("/recipes/{recipe_id}")
async def update_tenant_recipe(recipe_id: str, req: dict, user: dict = Depends(get_current_user)):
    """租户管理员 - 更新配方"""
    admin = require_tenant_admin(user)
    valid = ["name","description","ingredients","steps","category","status"]
    fields = []
    params = []
    for f in valid:
        if f in req:
            val = req[f]
            if f in ("ingredients", "steps") and isinstance(val, list):
                val = json.dumps(val, ensure_ascii=False)
                fields.append(f"{f}=${len(params)+1}::jsonb")
            else:
                fields.append(f"{f}=${len(params)+1}")
            params.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="没有要更新的字段")
    params.append(recipe_id)
    params.append(admin["tenant_id"])
    async with database.pool.acquire() as conn:
        result = await conn.execute(
            f"UPDATE recipes SET {', '.join(fields)}, updated_at=NOW() WHERE id=${len(params)-1} AND tenant_id=${len(params)}",
            *params)
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="配方不存在或无权操作")
    return {"code": 0, "msg": "配方已更新"}


@router.delete("/recipes/{recipe_id}")
async def delete_tenant_recipe(recipe_id: str, user: dict = Depends(get_current_user)):
    """租户管理员 - 删除配方（软删除）"""
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE recipes SET status='deleted', updated_at=NOW() WHERE id=$1 AND tenant_id=$2",
            recipe_id, admin["tenant_id"],
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="配方不存在或无权操作")
    return {"code": 0, "msg": "配方已删除"}


# ── 改密 ────────────────────────────────────────────

class ChangeTenantPasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.post("/change-password")
async def change_tenant_password(req: ChangeTenantPasswordRequest, user: dict = Depends(get_current_user)):
    import bcrypt
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, password_hash FROM users WHERE username=$1",
            user["user_id"].replace("u_", ""),
        )
        if not row:
            raise HTTPException(status_code=404, detail="用户不存在")
        if not bcrypt.checkpw(req.old_password.encode(), row["password_hash"].encode()):
            raise HTTPException(status_code=400, detail="旧密码错误")
        new_hash = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
        await conn.execute(
            "UPDATE users SET password_hash=$1 WHERE id=$2",
            new_hash, row["id"],
        )
    return {"code": 0, "msg": "密码修改成功"}


# ── 团队成员管理 ──────────────────────────────────────


@router.put("/members/{user_id}")
async def update_tenant_member(
    user_id: str, req: dict,
    current_user: dict = Depends(get_current_user),
):
    """更新成员信息（角色、昵称等）"""
    admin = require_tenant_admin(current_user)
    tenant_id = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        member = await conn.fetchrow(
            "SELECT tu.id, tu.role, tu.name FROM tenant_users tu WHERE tu.tenant_id=$1 AND tu.user_id=$2",
            tenant_id, user_id,
        )
        if not member:
            raise HTTPException(status_code=404, detail="成员不存在")
        # 不允许修改 owner
        if member["role"] == "owner":
            raise HTTPException(status_code=400, detail="不能修改租户所有者的角色")
        updates = []
        params = []
        idx = 1
        if "role" in req and req["role"] in ("member", "manager", "admin"):
            updates.append(f"role=${idx}"); params.append(req["role"]); idx += 1
        if "name" in req and req["name"]:
            updates.append(f"name=${idx}"); params.append(req["name"]); idx += 1
        if not updates:
            return {"code": 0, "msg": "无需更新"}
        params.append(tenant_id)
        params.append(user_id)
        await conn.execute(
            f"UPDATE tenant_users SET {', '.join(updates)} WHERE tenant_id=${idx} AND user_id=${idx+1}",
            *params,
        )
    return {"code": 0, "msg": "成员信息已更新"}


@router.delete("/members/{user_id}")
async def remove_tenant_member(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """从租户移除成员"""
    admin = require_tenant_admin(current_user)
    tenant_id = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        member = await conn.fetchrow(
            "SELECT tu.id, tu.role FROM tenant_users tu WHERE tu.tenant_id=$1 AND tu.user_id=$2",
            tenant_id, user_id,
        )
        if not member:
            raise HTTPException(status_code=404, detail="成员不存在")
        if member["role"] == "owner":
            raise HTTPException(status_code=400, detail="不能移除租户所有者")
        # 从 tenant_users 删除
        await conn.execute(
            "DELETE FROM tenant_users WHERE tenant_id=$1 AND user_id=$2",
            tenant_id, user_id,
        )
        # 可选：将 users 表中的 tenant_id 置空
        await conn.execute(
            "UPDATE users SET tenant_id=NULL WHERE username=$1 AND tenant_id=$2",
            user_id, tenant_id,
        )
    return {"code": 0, "msg": "成员已从租户移除"}


# ── 供应商管理（租户管理员） ──────────────────────────

@router.get("/suppliers")
async def tenant_list_suppliers(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM biz_suppliers WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 500",
            admin["tenant_id"],
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/suppliers")
async def tenant_create_supplier(req: dict, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO biz_suppliers (tenant_id, name, contact_person, phone, category,
                material_type, business_type, status, rating, address, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        """, admin["tenant_id"],
            req.get("name", ""), req.get("contact_person", ""), req.get("phone", ""),
            req.get("category", ""), req.get("material_type", ""), req.get("business_type", ""),
            req.get("status", "prospect"), req.get("rating", 0), req.get("address", ""), req.get("notes", ""),
        )
    return {"code": 0, "msg": "供应商已创建"}


@router.put("/suppliers/{supplier_id}")
async def tenant_update_supplier(supplier_id: int, req: dict, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    valid = ["name","contact_person","phone","category","material_type","business_type","status","rating","address","notes"]
    fields = [f"{f}=${i+1}" for i, f in enumerate(valid) if f in req]
    params = [req[f] for f in valid if f in req]
    if not fields: raise HTTPException(status_code=400, detail="没有要更新的字段")
    # 参数化 tenant_id 防止 SQL 注入
    params.append(admin['tenant_id'])
    params.append(supplier_id)
    async with database.pool.acquire() as conn:
        await conn.execute(
            f"UPDATE biz_suppliers SET {', '.join(fields)}, updated_at=NOW() WHERE tenant_id=${len(params)-1} AND id=${len(params)}",
            *params)
    return {"code": 0, "msg": "供应商已更新"}


@router.delete("/suppliers/{supplier_id}")
async def tenant_delete_supplier(supplier_id: int, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM biz_suppliers WHERE id=$1 AND tenant_id=$2", supplier_id, admin["tenant_id"])
    return {"code": 0, "msg": "供应商已删除"}


# ── 客户管理（租户管理员） ──────────────────────────

@router.get("/customers")
async def tenant_list_customers(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM biz_customers WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 500",
            admin["tenant_id"],
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/customers")
async def tenant_create_customer(req: dict, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO biz_customers (tenant_id, name, contact_person, phone, company, source, status, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        """, admin["tenant_id"],
            req.get("name", ""), req.get("contact_person", ""), req.get("phone", ""),
            req.get("company", ""), req.get("source", "chat"), req.get("status", "lead"), req.get("notes", ""),
        )
    return {"code": 0, "msg": "客户已创建"}


@router.put("/customers/{customer_id}")
async def tenant_update_customer(customer_id: int, req: dict, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    valid = ["name","contact_person","phone","company","source","status","notes","project_status"]
    fields = [f"{f}=${i+1}" for i, f in enumerate(valid) if f in req]
    params = [req[f] for f in valid if f in req]
    if not fields: raise HTTPException(status_code=400, detail="没有要更新的字段")
    params.append(customer_id)
    async with database.pool.acquire() as conn:
        await conn.execute(
            f"UPDATE biz_customers SET {', '.join(fields)}, updated_at=NOW() WHERE id=${len(params)} AND tenant_id='{admin['tenant_id']}'",
            *params)
    return {"code": 0, "msg": "客户已更新"}


@router.delete("/customers/{customer_id}")
async def tenant_delete_customer(customer_id: int, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM biz_customers WHERE id=$1 AND tenant_id=$2", customer_id, admin["tenant_id"])
    return {"code": 0, "msg": "客户已删除"}


# ── 发票管理（租户管理员） ──────────────────────────

@router.get("/invoices")
async def tenant_list_invoices(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT i.*, bp.name as project_name
               FROM invoices i
               LEFT JOIN biz_projects bp ON bp.id = i.project_id
               WHERE i.tenant_id=$1
               ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC LIMIT 500""",
            admin["tenant_id"],
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


def _to_date(val):
    if val is None or val == "":
        return None
    if isinstance(val, str):
        from datetime import date
        return date.fromisoformat(val[:10])
    return val


@router.post("/invoices")
async def tenant_create_invoice(req: dict, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO invoices (tenant_id, invoice_no, invoice_type, title,
                customer_name, supplier_name, amount, tax_amount, total_amount,
                invoice_date, due_date, status, payment_status,
                invoice_category, tax_rate, remarks, project_id, file_ids, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
        """, admin["tenant_id"],
            req.get("invoice_no", ""), req.get("invoice_type", "sales"), req.get("title", ""),
            req.get("customer_name", ""), req.get("supplier_name", ""),
            req.get("amount", 0.0), req.get("tax_amount", 0.0),
            req.get("total_amount", req.get("amount", 0.0) + req.get("tax_amount", 0.0)),
            _to_date(req.get("invoice_date")), _to_date(req.get("due_date")),
            req.get("status", "draft"), req.get("payment_status", "unpaid"),
            req.get("invoice_category", ""), req.get("tax_rate", 0.0), req.get("remarks", ""),
            req.get("project_id"),
            json.dumps(req.get("file_ids", []), ensure_ascii=False) if req.get("file_ids") else '[]',
        )
    return {"code": 0, "msg": "发票已创建"}


@router.put("/invoices/{invoice_id}")
async def tenant_update_invoice(invoice_id: int, req: dict, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    valid = ["invoice_no","invoice_type","title","customer_name","supplier_name","amount","tax_amount","total_amount","invoice_date","due_date","status","payment_status","remarks","project_id","file_ids"]
    fields = []
    params = []
    for f in valid:
        if f in req:
            fields.append(f"{f}=${len(params)+1}")
            params.append(req[f])
    if not fields: raise HTTPException(status_code=400, detail="没有要更新的字段")
    params.append(invoice_id)
    async with database.pool.acquire() as conn:
        await conn.execute(
            f"UPDATE invoices SET {', '.join(fields)}, updated_at=NOW() WHERE id=${len(params)} AND tenant_id='{admin['tenant_id']}'",
            *params)
    return {"code": 0, "msg": "发票已更新"}


@router.delete("/invoices/{invoice_id}")
async def tenant_delete_invoice(invoice_id: int, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute("DELETE FROM invoices WHERE id=$1 AND tenant_id=$2", invoice_id, admin["tenant_id"])
    return {"code": 0, "msg": "发票已删除"}


# ── 财务管理（租户管理员） ──────────────────────────

@router.get("/finance")
async def tenant_list_finance(user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT bf.*, bp.name as project_name
               FROM biz_finance bf
               LEFT JOIN biz_projects bp ON bp.id = bf.project_id
               WHERE bf.tenant_id=$1
               ORDER BY bf.created_at DESC LIMIT 500""",
            admin["tenant_id"],
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/finance")
async def tenant_create_finance(req: dict, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO biz_finance (tenant_id, project_id, type, category, amount, applicant_name, status,
                reason, file_ids, supplier_name, material_desc, expense_date, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        """, admin["tenant_id"],
            req.get("project_id"),
            req.get("type", "expense"), req.get("category", ""), req.get("amount", 0.0),
            req.get("applicant_name", ""), req.get("status", "pending"), req.get("reason", ""),
            json.dumps(req.get("file_ids", []), ensure_ascii=False) if req.get("file_ids") else '[]',
            req.get("supplier_name", ""), req.get("material_desc", ""),
            _to_date(req.get("expense_date")),
        )
    return {"code": 0, "msg": "财务记录已创建"}


@router.put("/finance/{record_id}")
async def tenant_update_finance(record_id: int, req: dict, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    valid = ["type","category","amount","applicant_name","status","reason","supplier_name","material_desc","expense_date","file_ids","project_id"]
    fields = []
    params = []
    for f in valid:
        if f in req:
            fields.append(f"{f}=${len(params)+1}")
            params.append(req[f])
    if not fields: raise HTTPException(status_code=400, detail="没有要更新的字段")
    params.append(record_id)
    async with database.pool.acquire() as conn:
        await conn.execute(
            f"UPDATE biz_finance SET {', '.join(fields)}, updated_at=NOW() WHERE id=${len(params)} AND tenant_id='{admin['tenant_id']}'",
            *params)
    return {"code": 0, "msg": "财务记录已更新"}


@router.delete("/finance/{record_id}")
async def tenant_delete_finance(record_id: int, user: dict = Depends(get_current_user)):
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        await conn.execute("DELETE FROM biz_finance WHERE id=$1 AND tenant_id=$2", record_id, admin["tenant_id"])
    return {"code": 0, "msg": "财务记录已删除"}


@router.get("/projects")
async def tenant_list_projects(user: dict = Depends(get_current_user)):
    """获取租户项目列表（完整字段）"""
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM biz_projects WHERE tenant_id=$1 ORDER BY created_at DESC",
            admin["tenant_id"],
        )
    return {"code": 0, "data": [dict(r) for r in rows]}


@router.post("/projects")
async def tenant_create_project(req: dict, user: dict = Depends(get_current_user)):
    """创建项目"""
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]
    name = req.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="项目名称不能为空")
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO biz_projects
               (tenant_id, name, customer, manager_name, manager_user_id, status, progress,
                contract_amount, budget, actual_cost, start_date, deadline, location, config)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
               RETURNING *""",
            tenant_id,
            name,
            req.get("customer", ""),
            req.get("manager_name", ""),
            req.get("manager_user_id", ""),
            req.get("status", "not_started"),
            req.get("progress", 0),
            req.get("contract_amount", 0),
            req.get("budget", 0),
            req.get("actual_cost", 0),
            req.get("start_date"),
            req.get("deadline"),
            req.get("location", ""),
            req.get("config", {}),
        )
    return {"code": 0, "data": dict(row), "msg": "项目创建成功"}


@router.put("/projects/{project_id}")
async def tenant_update_project(
    project_id: int, req: dict,
    user: dict = Depends(get_current_user),
):
    """更新项目信息"""
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]
    # 检查项目是否存在且属于该租户
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM biz_projects WHERE id=$1 AND tenant_id=$2", project_id, tenant_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="项目不存在")
        # 构建动态更新
        allowed_fields = [
            "name", "customer", "manager_name", "manager_user_id",
            "status", "progress", "contract_amount", "budget", "actual_cost",
            "start_date", "deadline", "location", "config",
        ]
        set_clauses = []
        params = []
        idx = 1
        for field in allowed_fields:
            if field in req:
                set_clauses.append(f"{field}=${idx}")
                params.append(req[field])
                idx += 1
        if not set_clauses:
            return {"code": 0, "msg": "无需更新"}
        set_clauses.append("updated_at=NOW()")
        params.append(project_id)
        params.append(tenant_id)
        row = await conn.fetchrow(
            f"UPDATE biz_projects SET {', '.join(set_clauses)} WHERE id=${idx} AND tenant_id=${idx+1} RETURNING *",
            *params,
        )
    return {"code": 0, "data": dict(row), "msg": "项目已更新"}


@router.delete("/projects/{project_id}")
async def tenant_delete_project(
    project_id: int,
    user: dict = Depends(get_current_user),
):
    """删除项目（级联删除关联的合同、财务记录等）"""
    admin = require_tenant_admin(user)
    tenant_id = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id, name FROM biz_projects WHERE id=$1 AND tenant_id=$2", project_id, tenant_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="项目不存在")
        # 级联删除关联数据
        await conn.execute("DELETE FROM biz_finance WHERE project_id=$1 AND tenant_id=$2", project_id, tenant_id)
        await conn.execute("DELETE FROM biz_contracts WHERE project_id=$1", project_id)
        await conn.execute("DELETE FROM documents WHERE project_id=$1", project_id)
        # 删除项目本身
        await conn.execute("DELETE FROM biz_projects WHERE id=$1 AND tenant_id=$2", project_id, tenant_id)
    return {"code": 0, "msg": f"项目「{existing['name']}」已删除"}


@router.get("/finance/project-summary")
async def tenant_finance_project_summary(user: dict = Depends(get_current_user)):
    """按项目统计收支汇总"""
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT bp.id as project_id, bp.name as project_name,
                      COALESCE(SUM(CASE WHEN bf.type='income' THEN bf.amount ELSE 0 END), 0) as total_income,
                      COALESCE(SUM(CASE WHEN bf.type='expense' THEN bf.amount ELSE 0 END), 0) as total_expense,
                      COUNT(bf.id) as record_count
               FROM biz_projects bp
               LEFT JOIN biz_finance bf ON bf.project_id = bp.id AND bf.tenant_id = $1
               WHERE bp.tenant_id = $1
               GROUP BY bp.id, bp.name
               ORDER BY total_expense DESC""",
            admin["tenant_id"],
        )
        result = []
        for r in rows:
            result.append({
                "project_id": r["project_id"],
                "project_name": r["project_name"],
                "total_income": float(r["total_income"]),
                "total_expense": float(r["total_expense"]),
                "profit": float(r["total_income"]) - float(r["total_expense"]),
                "record_count": r["record_count"],
            })
        # 汇总行
        total_income = sum(r["total_income"] for r in result)
        total_expense = sum(r["total_expense"] for r in result)
        return {"code": 0, "data": result, "summary": {
            "total_income": total_income,
            "total_expense": total_expense,
            "profit": total_income - total_expense,
        }}
    return {"code": 0, "data": []}

@router.get("/contracts")
async def tenant_list_contracts(user: dict = Depends(get_current_user)):
    """获取租户合同列表"""
    admin = require_tenant_admin(user)
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT c.*, bp.name as project_name
               FROM biz_contracts c
               LEFT JOIN biz_projects bp ON bp.id = c.project_id
               WHERE c.tenant_id=$1
               ORDER BY c.created_at DESC LIMIT 200""",
            admin["tenant_id"],
        )
    return {"code": 0, "data": [dict(r) for r in rows]}
