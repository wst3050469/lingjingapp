"""
灵境AI业务管家 - AI打卡审批引擎
自动校验打卡合理性：GPS距离、时间范围、历史模式
"""
import math
from datetime import datetime
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """计算两个GPS坐标之间的距离（米）"""
    R = 6371000  # 地球半径（米）
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def evaluate_checkin(
    tenant_id: str,
    user_id: str,
    project_id: int,
    check_time: datetime,
    latitude: float = None,
    longitude: float = None,
) -> dict:
    """
    AI打卡审批：校验打卡合理性
    返回: {"result": "normal/flagged", "checks": [...], "distance": float|None}
    """
    checks = []
    result = "normal"

    async with database.pool.acquire() as conn:
        # 1. GPS距离校验
        if latitude and longitude and project_id:
            proj = await conn.fetchrow(
                "SELECT latitude, longitude, location FROM biz_projects WHERE id=$1",
                project_id,
            )
            if proj and proj["latitude"] and proj["longitude"]:
                dist = _haversine(latitude, longitude, float(proj["latitude"]), float(proj["longitude"]))
                if dist > 500:
                    checks.append({
                        "type": "gps",
                        "pass": False,
                        "distance_m": round(dist),
                        "reason": f"打卡位置距离项目工地{round(dist)}米，超出500米范围",
                    })
                    result = "flagged"
                else:
                    checks.append({"type": "gps", "pass": True, "distance_m": round(dist)})

        # 2. 时间合理性校验
        hour = check_time.hour
        if hour < 5 or hour > 22:
            checks.append({
                "type": "time",
                "pass": False,
                "hour": hour,
                "reason": f"打卡时间 {check_time.strftime('%H:%M')} 不在正常工作时段（5:00-22:00）",
            })
            result = "flagged"
        else:
            checks.append({"type": "time", "pass": True, "hour": hour})

        # 3. 历史模式分析（近30天平均打卡时间）
        if project_id:
            history = await conn.fetch(
                """SELECT check_time FROM biz_attendance
                   WHERE tenant_id=$1 AND user_id=$2 AND project_id=$3
                   AND type='check_in' AND status='normal'
                   AND check_time > NOW() - interval '30 days'
                   ORDER BY check_time DESC LIMIT 30""",
                tenant_id, user_id, project_id,
            )
            if len(history) >= 5:
                avg_hour = sum(r["check_time"].hour + r["check_time"].minute / 60 for r in history) / len(history)
                current_hour = hour + check_time.minute / 60
                diff = abs(current_hour - avg_hour)
                if diff > 2:
                    checks.append({
                        "type": "pattern",
                        "pass": False,
                        "avg_hour": f"{int(avg_hour)}:{int((avg_hour % 1) * 60):02d}",
                        "reason": f"打卡时间偏离历史平均（{int(avg_hour)}:{int((avg_hour % 1) * 60):02d}）超过2小时",
                    })
                    if result != "flagged":
                        result = "flagged"
                else:
                    checks.append({"type": "pattern", "pass": True})

    return {"result": result, "checks": checks}
