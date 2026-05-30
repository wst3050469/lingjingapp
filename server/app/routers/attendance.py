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
