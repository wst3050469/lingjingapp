"""
灵境AI业务管家平台 - 统一业务数据API
为SCMS等外部系统提供数据推送接口，同时支持内部查询
"""
import secrets
import json
from typing import Optional, List
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database


def _parse_dt(val):
    """将字符串安全转为datetime，已经是datetime则直接返回"""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f",
                     "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z"):
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                continue
    return None


def _parse_date(val):
    """将字符串安全转为date"""
    if val is None:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        try:
            return date.fromisoformat(val[:10])
        except ValueError:
            return None
    return None

router = APIRouter(prefix="/api/v1/business", tags=["business"])


# ========== 认证 ==========

async def verify_tenant(x_api_key: str = Header(None), x_tenant_id: str = Header(None)) -> dict:
    """验证租户API Key，返回租户信息"""
    if not x_api_key or not x_tenant_id:
        raise HTTPException(status_code=401, detail="缺少 X-API-Key 或 X-Tenant-Id 头")
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT tenant_id, company_name, status, config FROM tenants WHERE tenant_id=$1 AND status='active'",
            x_tenant_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="租户不存在或已停用")
    # 从config中取api_key验证
    cfg = json.loads(row["config"]) if isinstance(row["config"], str) else (row["config"] or {})
    stored_key = cfg.get("api_key", "")
    if not stored_key or stored_key != x_api_key:
        raise HTTPException(status_code=403, detail="API Key无效")
    return {"tenant_id": row["tenant_id"], "company": row["company_name"]}


# ========== Pydantic 模型 ==========

class ProjectIn(BaseModel):
    ext_id: str
    name: str
    customer: str = ""
    manager_name: str = ""
    status: str = "in_progress"
    progress: int = 0
    contract_amount: float = 0
    budget: float = 0
    actual_cost: float = 0
    start_date: Optional[str] = None
    deadline: Optional[str] = None
    location: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    config: dict = Field(default_factory=dict)


class UserIn(BaseModel):
    user_id: str
    name: str
    phone: str = ""
    role: str = "worker"
    status: str = "active"
    ext_data: dict = Field(default_factory=dict)


class AttendanceIn(BaseModel):
    project_ext_id: Optional[str] = None
    user_id: str
    user_name: str = ""
    type: str  # check_in / check_out
    check_time: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: str = ""
    photo_url: str = ""
    status: str = "normal"


class QualityInspectionIn(BaseModel):
    ext_id: str
    project_ext_id: str
    inspection_type: str
    inspection_date: str
    inspector_name: str
    result: str = "pending"
    issues: str = ""
    rectification_required: bool = False
    rectification_status: str = ""
    photos: List[str] = Field(default_factory=list)
    remark: str = ""


class ProcessIn(BaseModel):
    ext_id: str
    project_ext_id: str
    name: str
    stage: str = ""
    sort_order: int = 0
    planned_start: Optional[str] = None
    planned_end: Optional[str] = None
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None
    status: str = "pending"
    progress: int = 0
    responsible_name: str = ""
    remarks: str = ""


class FinanceIn(BaseModel):
    ext_id: str
    project_ext_id: Optional[str] = None
    type: str  # expense, income, fund_application, wage
    category: str = ""
    amount: float
    applicant_name: str = ""
    status: str = "pending"
    reason: str = ""
    approved_by: str = ""
    approved_at: Optional[str] = None


class CustomerIn(BaseModel):
    ext_id: str
    name: str
    contact_person: str = ""
    phone: str = ""
    company: str = ""
    source: str = ""
    status: str = "lead"
    notes: str = ""

class SupplierIn(BaseModel):
    ext_id: str
    name: str
    contact_person: str = ""
    phone: str = ""
    category: str = ""
    material_type: str = ""
    business_type: str = ""
    status: str = "active"
    address: str = ""
    rating: int = 0
    notes: str = ""


class ContractIn(BaseModel):
    ext_id: str
    project_ext_id: Optional[str] = None
    contract_no: str = ""
    title: str = ""
    party_a: str = ""
    party_b: str = ""
    amount: float = 0
    sign_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str = "active"
    file_url: str = ""


class WebhookPayload(BaseModel):
    """批量推送载体"""
    event: str  # project.update, attendance.create, quality.create, etc.
    data: list  # 一批数据


# ========== 辅助 ==========

async def _resolve_project_id(conn, tenant_id: str, ext_id: str) -> Optional[int]:
    """根据外部ID查找灵境本地project_id"""
    if not ext_id:
        return None
    row = await conn.fetchrow(
        "SELECT id FROM biz_projects WHERE tenant_id=$1 AND ext_id=$2",
        tenant_id, ext_id,
    )
    return row["id"] if row else None


# ========== API Key管理 ==========

@router.post("/generate-key")
async def generate_api_key(
    x_tenant_id: str = Header(...),
    x_master_key: str = Header(...),
):
    """为租户生成API Key（需要master key）"""
    # 简单的master key验证
    if x_master_key != "lingjing-master-2026":
        raise HTTPException(status_code=403, detail="Master Key无效")

    api_key = f"lj_{secrets.token_urlsafe(32)}"
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT config FROM tenants WHERE tenant_id=$1 AND status='active'",
            x_tenant_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="租户不存在")
        cfg = json.loads(row["config"]) if isinstance(row["config"], str) else (row["config"] or {})
        cfg["api_key"] = api_key
        await conn.execute(
            "UPDATE tenants SET config=$1, updated_at=NOW() WHERE tenant_id=$2",
            json.dumps(cfg, ensure_ascii=False), x_tenant_id,
        )
    return {"tenant_id": x_tenant_id, "api_key": api_key, "msg": "API Key已生成，请妥善保管"}


# ========== 项目 ==========

@router.get("/projects")
async def list_projects(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    status: Optional[str] = None,
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        if status:
            rows = await conn.fetch(
                "SELECT * FROM biz_projects WHERE tenant_id=$1 AND status=$2 ORDER BY id",
                tid, status,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM biz_projects WHERE tenant_id=$1 ORDER BY id", tid,
            )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/projects")
async def upsert_project(
    item: ProjectIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO biz_projects (
                tenant_id, ext_id, name, customer, manager_name,
                status, progress, contract_amount, budget, actual_cost,
                start_date, deadline, location, latitude, longitude, config
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            ON CONFLICT (tenant_id, ext_id) DO UPDATE SET
                name=EXCLUDED.name, customer=EXCLUDED.customer,
                manager_name=EXCLUDED.manager_name, status=EXCLUDED.status,
                progress=EXCLUDED.progress, contract_amount=EXCLUDED.contract_amount,
                budget=EXCLUDED.budget, actual_cost=EXCLUDED.actual_cost,
                location=EXCLUDED.location, updated_at=NOW()
            RETURNING id
        """,
            tid, item.ext_id, item.name, item.customer, item.manager_name,
            item.status, item.progress, item.contract_amount, item.budget, item.actual_cost,
            _parse_date(item.start_date), _parse_date(item.deadline), item.location, item.latitude, item.longitude,
            json.dumps(item.config, ensure_ascii=False),
        )
    return {"code": 0, "id": row["id"], "msg": "项目已同步"}


# ========== 用户 ==========

@router.get("/users")
async def list_users(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    role: Optional[str] = None,
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        if role:
            rows = await conn.fetch(
                "SELECT * FROM tenant_users WHERE tenant_id=$1 AND role=$2 ORDER BY id",
                tid, role,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM tenant_users WHERE tenant_id=$1 ORDER BY id", tid,
            )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/users")
async def upsert_user(
    item: UserIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO tenant_users (tenant_id, user_id, name, phone, role, status, ext_data)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET
                name=EXCLUDED.name, phone=EXCLUDED.phone, role=EXCLUDED.role,
                status=EXCLUDED.status, ext_data=EXCLUDED.ext_data, updated_at=NOW()
        """,
            tid, item.user_id, item.name, item.phone, item.role, item.status,
            json.dumps(item.ext_data, ensure_ascii=False),
        )
    return {"code": 0, "msg": "用户已同步"}


# ========== 考勤 ==========

@router.get("/attendance")
async def list_attendance(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    project_id: Optional[int] = None,
    limit: int = Query(50, le=500),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        if project_id:
            rows = await conn.fetch(
                "SELECT * FROM biz_attendance WHERE tenant_id=$1 AND project_id=$2 ORDER BY check_time DESC LIMIT $3",
                tid, project_id, limit,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM biz_attendance WHERE tenant_id=$1 ORDER BY check_time DESC LIMIT $2",
                tid, limit,
            )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/attendance")
async def create_attendance(
    item: AttendanceIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        pid = await _resolve_project_id(conn, tid, item.project_ext_id)
        await conn.execute("""
            INSERT INTO biz_attendance (
                tenant_id, project_id, user_id, user_name, type,
                check_time, latitude, longitude, address, photo_url, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        """,
            tid, pid, item.user_id, item.user_name, item.type,
            _parse_dt(item.check_time), item.latitude, item.longitude,
            item.address, item.photo_url, item.status,
        )
    return {"code": 0, "msg": "考勤已记录"}


# ========== 质检 ==========

@router.get("/quality")
async def list_quality(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    project_id: Optional[int] = None,
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        if project_id:
            rows = await conn.fetch(
                "SELECT * FROM biz_quality_inspections WHERE tenant_id=$1 AND project_id=$2 ORDER BY inspection_date DESC",
                tid, project_id,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM biz_quality_inspections WHERE tenant_id=$1 ORDER BY inspection_date DESC",
                tid,
            )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/quality")
async def upsert_quality(
    item: QualityInspectionIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        pid = await _resolve_project_id(conn, tid, item.project_ext_id)
        await conn.execute("""
            INSERT INTO biz_quality_inspections (
                tenant_id, project_id, ext_id, inspection_type, inspection_date,
                inspector_name, result, issues, rectification_required,
                rectification_status, photos, remark
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT DO NOTHING
        """,
            tid, pid, item.ext_id, item.inspection_type, _parse_date(item.inspection_date),
            item.inspector_name, item.result, item.issues, item.rectification_required,
            item.rectification_status, item.photos, item.remark,
        )
    return {"code": 0, "msg": "质检记录已同步"}


# ========== 工序 ==========

@router.get("/processes")
async def list_processes(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    project_id: Optional[int] = None,
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        if project_id:
            rows = await conn.fetch(
                "SELECT * FROM biz_processes WHERE tenant_id=$1 AND project_id=$2 ORDER BY sort_order",
                tid, project_id,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM biz_processes WHERE tenant_id=$1 ORDER BY project_id, sort_order",
                tid,
            )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/processes")
async def upsert_process(
    item: ProcessIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        pid = await _resolve_project_id(conn, tid, item.project_ext_id)
        await conn.execute("""
            INSERT INTO biz_processes (
                tenant_id, project_id, ext_id, name, stage, sort_order,
                planned_start, planned_end, actual_start, actual_end,
                status, progress, responsible_name, remarks
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT DO NOTHING
        """,
            tid, pid, item.ext_id, item.name, item.stage, item.sort_order,
            _parse_date(item.planned_start), _parse_date(item.planned_end),
            _parse_date(item.actual_start), _parse_date(item.actual_end),
            item.status, item.progress, item.responsible_name, item.remarks,
        )
    return {"code": 0, "msg": "工序已同步"}


# ========== 财务 ==========

@router.get("/finance")
async def list_finance(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    project_id: Optional[int] = None,
    limit: int = Query(50, le=500),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        if project_id:
            rows = await conn.fetch(
                "SELECT * FROM biz_finance WHERE tenant_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT $3",
                tid, project_id, limit,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM biz_finance WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2",
                tid, limit,
            )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/finance")
async def upsert_finance(
    item: FinanceIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        pid = await _resolve_project_id(conn, tid, item.project_ext_id)
        await conn.execute("""
            INSERT INTO biz_finance (
                tenant_id, project_id, ext_id, type, category,
                amount, applicant_name, status, reason, approved_by, approved_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT DO NOTHING
        """,
            tid, pid, item.ext_id, item.type, item.category,
            item.amount, item.applicant_name, item.status,
            item.reason, item.approved_by, _parse_dt(item.approved_at),
        )
    return {"code": 0, "msg": "财务记录已同步"}


# ========== 客户 ==========

@router.get("/customers")
async def list_customers(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM biz_customers WHERE tenant_id=$1 ORDER BY id", tid,
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}

@router.get("/suppliers")
async def list_suppliers(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM biz_suppliers WHERE tenant_id=$1 ORDER BY id", tid,
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}

@router.post("/suppliers")
async def upsert_supplier(
    item: SupplierIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO biz_suppliers (
                tenant_id, ext_id, name, contact_person, phone,
                category, material_type, business_type, status, address, rating, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (tenant_id, ext_id) WHERE ext_id IS NOT NULL DO UPDATE SET
                name=EXCLUDED.name, contact_person=EXCLUDED.contact_person,
                phone=EXCLUDED.phone, material_type=EXCLUDED.material_type,
                business_type=EXCLUDED.business_type, status=EXCLUDED.status,
                address=EXCLUDED.address, rating=EXCLUDED.rating, updated_at=NOW()
            RETURNING id
        """,
            tid, item.ext_id, item.name, item.contact_person, item.phone,
            item.category, item.material_type, item.business_type,
            item.status, item.address, item.rating, item.notes,
        )
    return {"code": 0, "id": row["id"], "msg": "供应商已同步"}

@router.post("/customers")
async def upsert_customer(
    item: CustomerIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO biz_customers (
                tenant_id, ext_id, name, contact_person, phone,
                company, source, status, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (tenant_id, ext_id) DO UPDATE SET
                name=EXCLUDED.name, contact_person=EXCLUDED.contact_person,
                phone=EXCLUDED.phone, status=EXCLUDED.status, updated_at=NOW()
        """,
            tid, item.ext_id, item.name, item.contact_person,
            item.phone, item.company, item.source, item.status, item.notes,
        )
    return {"code": 0, "msg": "客户已同步"}


@router.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: int,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """删除客户"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM biz_customers WHERE id=$1 AND tenant_id=$2",
            customer_id, tid,
        )
    return {"code": 0, "msg": "客户已删除"}


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: int,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """删除供应商"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM biz_suppliers WHERE id=$1 AND tenant_id=$2",
            supplier_id, tid,
        )
    return {"code": 0, "msg": "供应商已删除"}


# ========== 合同 ==========

@router.get("/contracts")
async def list_contracts(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    project_id: Optional[int] = None,
    status: Optional[str] = None,
):
    """查询合同列表"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        where = "WHERE tenant_id=$1"
        params: list = [tid]
        idx = 2
        if project_id:
            where += f" AND project_id=${idx}"
            params.append(project_id)
            idx += 1
        if status:
            where += f" AND status=${idx}"
            params.append(status)
            idx += 1
        rows = await conn.fetch(
            f"SELECT * FROM biz_contracts {where} ORDER BY sign_date DESC NULLS LAST, created_at DESC",
            *params,
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.post("/contracts")
async def upsert_contract(
    item: ContractIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        pid = await _resolve_project_id(conn, tid, item.project_ext_id)
        await conn.execute("""
            INSERT INTO biz_contracts (
                tenant_id, project_id, ext_id, contract_no, title,
                party_a, party_b, amount, sign_date, start_date, end_date,
                status, file_url
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT DO NOTHING
        """,
            tid, pid, item.ext_id, item.contract_no, item.title,
            item.party_a, item.party_b, item.amount,
            _parse_date(item.sign_date), _parse_date(item.start_date), _parse_date(item.end_date),
            item.status, item.file_url,
        )
    return {"code": 0, "msg": "合同已同步"}


@router.put("/contracts/{contract_id}")
async def update_contract(
    contract_id: int,
    item: ContractIn,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """更新合同"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        pid = await _resolve_project_id(conn, tid, item.project_ext_id)
        await conn.execute("""
            UPDATE biz_contracts SET
                project_id=$1, contract_no=$2, title=$3, party_a=$4, party_b=$5,
                amount=$6, sign_date=$7, start_date=$8, end_date=$9,
                status=$10, file_url=$11, updated_at=NOW()
            WHERE id=$12 AND tenant_id=$13
        """,
            pid, item.contract_no, item.title, item.party_a, item.party_b,
            item.amount, _parse_date(item.sign_date), _parse_date(item.start_date),
            _parse_date(item.end_date), item.status, item.file_url,
            contract_id, tid,
        )
    return {"code": 0, "msg": "合同已更新"}


@router.delete("/contracts/{contract_id}")
async def delete_contract(
    contract_id: int,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """删除合同"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM biz_contracts WHERE id=$1 AND tenant_id=$2",
            contract_id, tid,
        )
    return {"code": 0, "msg": "合同已删除"}


from services.approval_engine import evaluate_approval
from services.daily_report import generate_daily_report, get_latest_report


# ========== AI审批 ==========

class ApprovalRequest(BaseModel):
    project_ext_id: str
    target_stage: str  # 要施工的工序阶段代码
    applicant_name: str
    request_content: str  # 施工内容描述


@router.post("/approval/request")
async def request_approval(
    item: ApprovalRequest,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """
    施工审批申请 - 项目经理提交施工计划，AI自动审批
    AI会检查：天气温度、养护期、降雨、风力、考勤等
    """
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]

    # 查找项目
    async with database.pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT id, name, location, latitude, longitude FROM biz_projects WHERE tenant_id=$1 AND ext_id=$2",
            tid, item.project_ext_id,
        )
    if not project:
        raise HTTPException(status_code=404, detail=f"项目不存在: ext_id={item.project_ext_id}")

    result = await evaluate_approval(
        tenant_id=tid,
        project_id=project["id"],
        target_stage=item.target_stage,
        applicant_name=item.applicant_name,
        request_content=item.request_content,
        project_location=project["location"] or "",
        project_latitude=float(project["latitude"]) if project["latitude"] else None,
        project_longitude=float(project["longitude"]) if project["longitude"] else None,
    )

    # 构建人话回复
    if result["result"] == "approved":
        msg = f"审批通过。{item.applicant_name}可以开始施工: {item.request_content}"
        if result["warnings"]:
            msg += f"\n注意事项: {'; '.join(result['warnings'])}"
    elif result["result"] == "rejected":
        msg = "审批被拒绝！\n原因:\n" + "\n".join(f"  - {r}" for r in result["reject_reasons"])
        msg += f"\n\n{item.applicant_name}，请解决以上问题后重新申请。违规施工将扣除工资和奖金。"
    else:
        msg = "审批待人工确认。部分检查项无法自动判定，已通知管理员。"

    return {
        "code": 0,
        "result": result["result"],
        "message": msg,
        "checks": result["checks"],
        "reject_reasons": result["reject_reasons"],
        "warnings": result["warnings"],
    }


@router.get("/approval/history")
async def approval_history(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    project_id: Optional[int] = None,
    limit: int = Query(20, le=100),
):
    """查看审批历史"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        if project_id:
            rows = await conn.fetch(
                "SELECT * FROM ai_approvals WHERE tenant_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT $3",
                tid, project_id, limit,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM ai_approvals WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2",
                tid, limit,
            )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.get("/alerts")
async def list_alerts(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
    status: str = "active",
):
    """查看预警列表"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM ai_alerts WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC",
            tid, status,
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


@router.get("/rules")
async def list_rules(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """查看施工规范规则"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM ai_construction_rules WHERE tenant_id=$1 ORDER BY id",
            tid,
        )
    return {"code": 0, "data": [dict(r) for r in rows], "total": len(rows)}


# ========== 综合仪表盘 ==========

@router.get("/dashboard")
async def dashboard(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """老板一站式看板：项目概览 + 今日预警 + 考勤 + 财务"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    tid = tenant["tenant_id"]
    async with database.pool.acquire() as conn:
        # 项目概览
        projects = await conn.fetch(
            "SELECT id, name, progress, status, contract_amount, location, manager_name FROM biz_projects WHERE tenant_id=$1",
            tid,
        )
        # 活跃预警
        alerts = await conn.fetch(
            "SELECT id, alert_type, severity, title, detail, created_at FROM ai_alerts WHERE tenant_id=$1 AND status='active' ORDER BY created_at DESC LIMIT 10",
            tid,
        )
        # 今日考勤统计
        attendance_today = await conn.fetchval(
            "SELECT COUNT(*) FROM biz_attendance WHERE tenant_id=$1 AND check_time::date = CURRENT_DATE",
            tid,
        )
        # 待审批
        pending_approvals = await conn.fetchval(
            "SELECT COUNT(*) FROM ai_approvals WHERE tenant_id=$1 AND result='pending_review'",
            tid,
        )
        # 财务汇总
        finance_summary = await conn.fetchrow("""
            SELECT
                COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type IN ('expense','fund_application','wage') THEN amount ELSE 0 END), 0) as total_expense
            FROM biz_finance WHERE tenant_id=$1
        """, tid)

    return {
        "code": 0,
        "data": {
            "projects": [dict(p) for p in projects],
            "project_count": len(projects),
            "active_alerts": [dict(a) for a in alerts],
            "alert_count": len(alerts),
            "attendance_today": attendance_today,
            "pending_approvals": pending_approvals,
            "finance": {
                "total_income": float(finance_summary["total_income"]),
                "total_expense": float(finance_summary["total_expense"]),
            },
        },
    }


# ========== 每日汇报 ==========

@router.post("/report/generate")
async def generate_report(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """手动触发生成今日汇报（也可由crontab自动触发）"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    result = await generate_daily_report(tenant["tenant_id"])
    return {
        "code": 0,
        "date": result["date"],
        "summary": result["summary"],
    }


@router.get("/report/latest")
async def latest_report(
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """获取最新一期日报"""
    tenant = await verify_tenant(x_api_key, x_tenant_id)
    report = await get_latest_report(tenant["tenant_id"])
    if not report:
        return {"code": 0, "data": None, "msg": "暂无日报"}
    return {"code": 0, "data": report}


# ========== Webhook 批量推送 ==========

@router.post("/webhook")
async def webhook(
    payload: WebhookPayload,
    x_api_key: str = Header(...), x_tenant_id: str = Header(...),
):
    """
    SCMS Webhook端点 - 接收批量数据推送
    event格式: "resource.action" (如 attendance.create, project.update)
    """
    _ = await verify_tenant(x_api_key, x_tenant_id)
    event = payload.event
    data = payload.data
    results = {"processed": 0, "errors": []}

    for i, item in enumerate(data):
        try:
            if event == "attendance.create":
                await create_attendance(
                    AttendanceIn(**item),
                    x_api_key=x_api_key, x_tenant_id=x_tenant_id,
                )
            elif event == "project.update":
                await upsert_project(
                    ProjectIn(**item),
                    x_api_key=x_api_key, x_tenant_id=x_tenant_id,
                )
            elif event == "quality.create":
                await upsert_quality(
                    QualityInspectionIn(**item),
                    x_api_key=x_api_key, x_tenant_id=x_tenant_id,
                )
            elif event == "process.update":
                await upsert_process(
                    ProcessIn(**item),
                    x_api_key=x_api_key, x_tenant_id=x_tenant_id,
                )
            elif event == "finance.create":
                await upsert_finance(
                    FinanceIn(**item),
                    x_api_key=x_api_key, x_tenant_id=x_tenant_id,
                )
            elif event == "customer.update":
                await upsert_customer(
                    CustomerIn(**item),
                    x_api_key=x_api_key, x_tenant_id=x_tenant_id,
                )
            elif event == "supplier.update":
                await upsert_supplier(
                    SupplierIn(**item),
                    x_api_key=x_api_key, x_tenant_id=x_tenant_id,
                )
            elif event == "user.update":
                await upsert_user(
                    UserIn(**item),
                    x_api_key=x_api_key, x_tenant_id=x_tenant_id,
                )
            else:
                results["errors"].append({"index": i, "error": f"未知事件: {event}"})
                continue
            results["processed"] += 1
        except Exception as e:
            results["errors"].append({"index": i, "error": str(e)})

    return {
        "code": 0,
        "event": event,
        "total": len(data),
        "processed": results["processed"],
        "errors": results["errors"],
    }
