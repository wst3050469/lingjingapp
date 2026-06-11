"""
灵境AI业务管家 - 工资自动计算引擎
根据打卡天数 x 日薪 自动计算月度工资
"""
import json
from datetime import date
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database


async def calculate_monthly_wages(tenant_id: str, year: int = None, month: int = None) -> list[dict]:
    """
    计算月度工资：
    1. 获取所有 worker 角色的 tenant_users（含 ext_data.daily_wage）
    2. 统计每个工人在指定月份的有效打卡天数（status='normal' 的 check_in 记录）
    3. 工资 = 有效天数 x 日薪
    """
    today = date.today()
    if not year:
        year = today.year
    if not month:
        month = today.month

    # 月份起止（必须是 date 对象，不能是字符串，否则 asyncpg 报错）
    from datetime import date as _date
    start_date = _date(year, month, 1)
    if month == 12:
        end_date = _date(year + 1, 1, 1)
    else:
        end_date = _date(year, month + 1, 1)

    async with database.pool.acquire() as conn:
        # 获取所有工人
        workers = await conn.fetch(
            "SELECT user_id, name, role, ext_data FROM tenant_users WHERE tenant_id=$1 AND role='worker'",
            tenant_id,
        )
        if not workers:
            return []

        results = []
        for w in workers:
            ext = json.loads(w["ext_data"]) if isinstance(w["ext_data"], str) else (w["ext_data"] or {})
            daily_wage = 0
            try:
                daily_wage = float(ext.get("daily_wage", 0))
            except (ValueError, TypeError):
                pass
            worker_type = ext.get("worker_type", "")

            # 统计有效打卡天数（每天只算一次 check_in，status=normal）
            days = await conn.fetchval(
                """SELECT COUNT(DISTINCT check_time::date)
                   FROM biz_attendance
                   WHERE tenant_id=$1 AND user_id=$2
                   AND type='check_in' AND status='normal'
                   AND check_time >= $3::date AND check_time < $4::date""",
                tenant_id, w["user_id"], start_date, end_date,
            )
            # 异常天数
            flagged_days = await conn.fetchval(
                """SELECT COUNT(DISTINCT check_time::date)
                   FROM biz_attendance
                   WHERE tenant_id=$1 AND user_id=$2
                   AND type='check_in' AND status='flagged'
                   AND check_time >= $3::date AND check_time < $4::date""",
                tenant_id, w["user_id"], start_date, end_date,
            )

            total_wage = days * daily_wage

            results.append({
                "user_id": w["user_id"],
                "name": w["name"],
                "worker_type": worker_type,
                "daily_wage": daily_wage,
                "valid_days": days,
                "flagged_days": flagged_days or 0,
                "total_wage": total_wage,
            })

    return results


async def get_wage_summary(tenant_id: str, year: int = None, month: int = None) -> str:
    """生成工资概览文本（注入AI上下文）"""
    today = date.today()
    if not year:
        year = today.year
    if not month:
        month = today.month

    wages = await calculate_monthly_wages(tenant_id, year, month)
    if not wages:
        return f"{year}年{month}月暂无工人工资数据（没有工人角色的成员或没有打卡记录）"

    lines = [f"📊 {year}年{month}月工资概览："]
    total_all = 0
    for w in wages:
        line = f"  {w['name']}（{w['worker_type']}）：有效{w['valid_days']}天"
        if w["flagged_days"]:
            line += f"，异常{w['flagged_days']}天"
        line += f" × {w['daily_wage']:.0f}元/天 = {w['total_wage']:.0f}元"
        lines.append(line)
        total_all += w["total_wage"]

    lines.append(f"  合计：{total_all:,.0f}元")
    return "\n".join(lines)
