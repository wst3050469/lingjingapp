"""
灵境AI业务管家 - 每日自动汇报生成器
每日自动汇总各项目的进展、考勤、预警、财务，调用AI生成汇报
可通过crontab定时执行，也可通过API手动触发
"""
import json
import httpx
from datetime import date

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database, config


async def collect_daily_data(tenant_id: str) -> dict:
    """收集今日所有业务数据"""
    async with database.pool.acquire() as conn:
        # 项目概览
        projects = await conn.fetch(
            "SELECT id, ext_id, name, progress, status, contract_amount, location, manager_name FROM biz_projects WHERE tenant_id=$1",
            tenant_id,
        )

        # 今日考勤
        attendance_today = await conn.fetch("""
            SELECT ba.user_name, ba.type, ba.check_time, ba.address, bp.name as project
            FROM biz_attendance ba
            LEFT JOIN biz_projects bp ON bp.id = ba.project_id
            WHERE ba.tenant_id=$1 AND ba.check_time::date = CURRENT_DATE
            ORDER BY ba.check_time
        """, tenant_id)

        # 活跃预警
        alerts = await conn.fetch(
            "SELECT alert_type, severity, title, detail FROM ai_alerts WHERE tenant_id=$1 AND status='active' ORDER BY created_at DESC",
            tenant_id,
        )

        # 今日审批
        approvals_today = await conn.fetch("""
            SELECT applicant_name, result, reject_reason, bp.name as project
            FROM ai_approvals aa
            LEFT JOIN biz_projects bp ON bp.id = aa.project_id
            WHERE aa.tenant_id=$1 AND aa.created_at::date = CURRENT_DATE
        """, tenant_id)

        # 最近7天财务
        finance_7d = await conn.fetch("""
            SELECT bf.type, bf.amount, bf.applicant_name, bf.status, bp.name as project
            FROM biz_finance bf
            LEFT JOIN biz_projects bp ON bp.id = bf.project_id
            WHERE bf.tenant_id=$1 AND bf.created_at > NOW() - interval '7 days'
        """, tenant_id)

        # 各项目天气（天气服务已移除）
        weather_data = {}
        # weather API previously: w = await get_weather(p["location"])

    return {
        "date": str(date.today()),
        "projects": [dict(p) for p in projects],
        "attendance_today": [dict(a) for a in attendance_today],
        "alerts": [dict(a) for a in alerts],
        "approvals_today": [dict(a) for a in approvals_today],
        "finance_7d": [dict(f) for f in finance_7d],
        "weather": weather_data,
    }


def format_report_prompt(data: dict) -> str:
    """将原始数据格式化为AI可读的汇报prompt"""
    lines = [f"今日日期: {data['date']}"]

    # 项目
    lines.append("\n【项目概况】")
    for p in data["projects"]:
        lines.append(f"  {p['name']}: 进度{p['progress']}%, 合同额¥{p['contract_amount']:,.0f}, 项目经理:{p['manager_name']}, 地点:{p['location']}")
        # 天气
        w = data["weather"].get(p["name"])
        if w:
            lines.append(f"    当地天气: {w['text']} {w['temp']}°C 湿度{w['humidity']}% 风{w['wind_scale']}级 降水{w['precip']}mm")

    # 考勤
    lines.append(f"\n【今日考勤】({len(data['attendance_today'])}条记录)")
    if data["attendance_today"]:
        for a in data["attendance_today"]:
            t = "签到" if a["type"] == "check_in" else "签退"
            lines.append(f"  {a['user_name']} {t} {str(a['check_time'])[:16]} - {a['project']}")
    else:
        lines.append("  今日暂无考勤记录")

    # 预警
    lines.append(f"\n【活跃预警】({len(data['alerts'])}条)")
    if data["alerts"]:
        for a in data["alerts"]:
            lines.append(f"  [{a['severity']}] {a['title']}: {a['detail'][:100]}")
    else:
        lines.append("  无预警，一切正常")

    # 审批
    lines.append(f"\n【今日审批】({len(data['approvals_today'])}条)")
    if data["approvals_today"]:
        for a in data["approvals_today"]:
            result_zh = {"approved": "通过", "rejected": "拒绝", "pending_review": "待确认"}.get(a["result"], a["result"])
            lines.append(f"  {a['applicant_name']} ({a['project']}): {result_zh}")
            if a.get("reject_reason"):
                lines.append(f"    原因: {a['reject_reason'][:80]}")

    # 财务
    total_expense = sum(f["amount"] for f in data["finance_7d"] if f["type"] != "income")
    total_income = sum(f["amount"] for f in data["finance_7d"] if f["type"] == "income")
    lines.append(f"\n【近7天财务】支出¥{total_expense:,.0f} 收入¥{total_income:,.0f}")

    return "\n".join(lines)


async def generate_daily_report(tenant_id: str) -> dict:
    """
    生成每日汇报：收集数据 -> 调AI生成文字汇报 -> 存入数据库
    返回 {"summary": "...", "data": {...}}
    """
    # 1. 收集数据
    data = await collect_daily_data(tenant_id)

    # 1.5 动态加载企业信息
    company_name = "你的企业"
    owner_name = "老板"
    async with database.pool.acquire() as conn:
        tenant_row = await conn.fetchrow(
            "SELECT company_name, owner_name FROM tenants WHERE tenant_id=$1", tenant_id
        )
        if tenant_row:
            company_name = tenant_row["company_name"] or company_name
            owner_name = tenant_row["owner_name"] or owner_name

    # 2. 调AI生成汇报文字
    raw_data_text = format_report_prompt(data)

    messages = [
        {
            "role": "system",
            "content": f"""你是{company_name}的AI管家，每天为老板{owner_name}生成工作汇报。
要求：
- 简洁、直接、不废话
- 先说结论，再说细节
- 重点标出异常/风险/需要关注的事项
- 语气像一个靠谱的助手在汇报，不要客套话
- 控制在300字以内
- 如果有需要老板决策的事项，明确提出来"""
        },
        {
            "role": "user",
            "content": f"根据以下数据生成今日工作汇报：\n\n{raw_data_text}"
        },
    ]

    summary = ""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.DEEPSEEK_MODEL,
                    "messages": messages,
                    "max_tokens": 800,
                    "stream": False,
                },
            )
            result = resp.json()
            summary = result["choices"][0]["message"]["content"]
    except Exception as e:
        summary = f"AI汇报生成失败: {str(e)[:100]}\n\n原始数据:\n{raw_data_text}"

    # 3. 存入数据库
    today = date.today()
    async with database.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO ai_daily_reports (tenant_id, report_date, summary, data)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tenant_id, report_date) DO UPDATE SET
                summary = EXCLUDED.summary,
                data = EXCLUDED.data,
                delivered = FALSE,
                created_at = NOW()
        """,
            tenant_id, today, summary,
            json.dumps(data, ensure_ascii=False, default=str),
        )

    return {
        "date": str(today),
        "summary": summary,
        "data": data,
        "tenant_id": tenant_id,
    }


async def get_latest_report(tenant_id: str) -> dict | None:
    """获取最新的日报"""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT report_date, summary, data, delivered, created_at
            FROM ai_daily_reports
            WHERE tenant_id=$1
            ORDER BY report_date DESC
            LIMIT 1
        """, tenant_id)
    if not row:
        return None
    return {
        "date": str(row["report_date"]),
        "summary": row["summary"],
        "delivered": row["delivered"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }
