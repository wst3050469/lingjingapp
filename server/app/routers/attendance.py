"""考勤路由"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from services import AttendanceService

router = APIRouter(prefix="/api/attendance", tags=["考勤打卡"])
attendance_service = AttendanceService()

class CheckInRequest(BaseModel):
    user_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None

class CheckOutRequest(BaseModel):
    user_id: str

@router.post("/check-in")
async def check_in(req: CheckInRequest):
    """上班打卡"""
    location = {"latitude": req.latitude, "longitude": req.longitude, "address": req.address}
    result = await attendance_service.check_in(req.user_id, location)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/check-out")
async def check_out(req: CheckOutRequest):
    """下班打卡"""
    result = await attendance_service.check_out(req.user_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.get("/today/{user_id}")
async def get_today_records(user_id: str):
    """获取今日打卡记录"""
    records = await attendance_service.get_today_records(user_id)
    return {"records": records}

@router.get("/stats/{user_id}")
async def get_stats(user_id: str, month: Optional[str] = None):
    """获取考勤统计"""
    stats = await attendance_service.get_month_stats(user_id, month)
    return stats


@router.get("/records/{user_id}")
async def get_records(user_id: str, month: Optional[str] = None):
    """获取指定月份的打卡记录列表"""
    if month:
        from datetime import date
        year, mon = map(int, month.split("-"))
        start = date(year, mon, 1)
        if mon == 12:
            end = date(year + 1, 1, 1)
        else:
            end = date(year, mon + 1, 1)
        records = await attendance_service.get_records(user_id, start, end)
    else:
        records = await attendance_service.get_today_records(user_id)
    return {"records": records}


class WageResponse(BaseModel):
    daily_wage: float = 0
    records: list = []
    total_paid: float = 0


class FundApplyRequest(BaseModel):
    user_id: str
    amount: float
    reason: str = ""
    project_name: str = ""


@router.get("/wages/{user_id}")
async def get_wages(user_id: str):
    """获取工人工资信息（日薪 + 工资支付记录）"""
    import json, db as database

    wage_info = {"daily_wage": 0, "records": [], "total_paid": 0}

    async with database.pool.acquire() as conn:
        # 1. 从 tenant_users.ext_data 获取日薪
        tu = await conn.fetchrow(
            "SELECT ext_data FROM tenant_users WHERE user_id=$1", user_id
        )
        if tu and tu["ext_data"]:
            ext = json.loads(tu["ext_data"]) if isinstance(tu["ext_data"], str) else tu["ext_data"]
            wage_info["daily_wage"] = float(ext.get("daily_wage", 0))

        # 2. 从 biz_finance 查询工资支付记录
        rows = await conn.fetch(
            """SELECT bf.*, bp.name as project_name
               FROM biz_finance bf
               LEFT JOIN biz_projects bp ON bp.id = bf.project_id
               WHERE bf.applicant_name = $1 AND bf.type = 'wage'
               ORDER BY bf.created_at DESC LIMIT 20""",
            user_id,
        )
        wage_info["records"] = [
            {
                "id": r["id"],
                "amount": float(r["amount"]),
                "project_name": r.get("project_name", ""),
                "status": r["status"],
                "created_at": str(r["created_at"]) if r["created_at"] else "",
                "reason": r.get("reason", ""),
            }
            for r in rows
        ]
        wage_info["total_paid"] = sum(r["amount"] for r in wage_info["records"])

    return wage_info


@router.post("/fund-apply")
async def apply_fund(req: FundApplyRequest):
    """工人申请备用金"""
    import db as database

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")

    # 查找 user 的 tenant_id
    async with database.pool.acquire() as conn:
        tu = await conn.fetchrow(
            "SELECT tenant_id FROM tenant_users WHERE user_id=$1", req.user_id
        )
        if not tu:
            raise HTTPException(status_code=404, detail="用户不存在")

        # 查找项目ID（根据项目名称）
        pid = None
        if req.project_name:
            proj = await conn.fetchrow(
                "SELECT id FROM biz_projects WHERE tenant_id=$1 AND name=$2",
                tu["tenant_id"], req.project_name,
            )
            pid = proj["id"] if proj else None

        # 创建备用金申请记录
        row = await conn.fetchrow(
            """INSERT INTO biz_finance
               (tenant_id, project_id, type, category, amount, applicant_name, status, reason)
               VALUES ($1, $2, 'fund_application', 'reserve_fund', $3, $4, 'pending', $5)
               RETURNING id""",
            tu["tenant_id"], pid, req.amount, req.user_id, req.reason[:200] if req.reason else "备用金申请",
        )

    return {"code": 0, "id": row["id"], "amount": req.amount, "status": "pending", "msg": "备用金申请已提交"}
