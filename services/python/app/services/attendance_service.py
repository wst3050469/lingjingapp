"""考勤服务"""
from typing import List, Dict
from datetime import datetime, date
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db

class AttendanceService:
    """考勤服务"""

    async def check_in(self, user_id: str, location: Dict = None) -> Dict:
        """上班打卡"""
        today = date.today()

        # 检查今天是否已打卡
        existing = await db.fetchone(
            """SELECT id FROM attendance
               WHERE user_id = $1
               AND DATE(check_time) = $2
               AND type = 'check_in'""",
            user_id, today
        )

        if existing:
            return {"success": False, "error": "今天已经打过上班卡了"}

        # 创建打卡记录
        check_time = datetime.now()
        lat = location.get("latitude") if location else None
        lng = location.get("longitude") if location else None
        addr = location.get("address") if location else None
        
        record_id = await db.insert(
            """INSERT INTO attendance
               (user_id, type, check_time, latitude, longitude, address)
               VALUES ($1, 'check_in', $2, $3, $4, $5)
               RETURNING id""",
            user_id, check_time, lat, lng, addr
        )

        return {
            "success": True,
            "record_id": record_id,
            "check_time": check_time.strftime("%Y-%m-%d %H:%M:%S"),
        }

    async def check_out(self, user_id: str, location: Dict = None) -> Dict:
        """下班打卡"""
        today = date.today()

        # 检查今天是否已下班打卡
        existing = await db.fetchone(
            """SELECT id FROM attendance
               WHERE user_id = $1
               AND DATE(check_time) = $2
               AND type = 'check_out'""",
            user_id, today
        )

        if existing:
            return {"success": False, "error": "今天已经打过下班卡了"}

        # 获取上班打卡时间计算工作时长
        check_in = await db.fetchone(
            """SELECT check_time FROM attendance
               WHERE user_id = $1
               AND DATE(check_time) = $2
               AND type = 'check_in'
               ORDER BY check_time ASC
               LIMIT 1""",
            user_id, today
        )

        check_time = datetime.now()
        lat = location.get("latitude") if location else None
        lng = location.get("longitude") if location else None
        addr = location.get("address") if location else None
        
        record_id = await db.insert(
            """INSERT INTO attendance
               (user_id, type, check_time, latitude, longitude, address)
               VALUES ($1, 'check_out', $2, $3, $4, $5)
               RETURNING id""",
            user_id, check_time, lat, lng, addr
        )

        # 计算工作时长
        hours = 0
        if check_in:
            delta = check_time - check_in["check_time"]
            hours = delta.total_seconds() / 3600

        return {
            "success": True,
            "record_id": record_id,
            "check_time": check_time.strftime("%Y-%m-%d %H:%M:%S"),
            "hours": round(hours, 1),
        }

    async def get_today_records(self, user_id: str) -> List[Dict]:
        """获取今日打卡记录"""
        today = date.today()
        return await db.fetchall(
            """SELECT * FROM attendance
               WHERE user_id = $1 AND DATE(check_time) = $2
               ORDER BY check_time""",
            user_id, today
        )

    async def get_records(self, user_id: str, start_date: date,
                          end_date: date) -> List[Dict]:
        """获取指定日期范围的打卡记录"""
        return await db.fetchall(
            """SELECT * FROM attendance
               WHERE user_id = $1
               AND DATE(check_time) BETWEEN $2 AND $3
               ORDER BY check_time""",
            user_id, start_date, end_date
        )

    async def get_month_stats(self, user_id: str, month: str = None) -> Dict:
        """获取月度考勤统计"""
        if not month:
            month = date.today().strftime("%Y-%m")

        start_date = f"{month}-01"
        year, mon = map(int, month.split("-"))
        if mon == 12:
            end_date = f"{year+1}-01-01"
        else:
            end_date = f"{year}-{mon+1:02d}-01"

        records = await self.get_records(user_id, start_date, end_date)

        # 统计
        check_in_days = set()
        check_out_days = set()
        overtime_hours = 0

        for r in records:
            day = r["check_time"].date().isoformat()
            if r["type"] == "check_in":
                check_in_days.add(day)
            else:
                check_out_days.add(day)

        return {
            "month": month,
            "days": len(check_in_days),
            "check_in_count": len(check_in_days),
            "check_out_count": len(check_out_days),
            "overtime": overtime_hours,
        }
