"""灵境 — 待办事项服务（自动生成 + 手动 + 完成）
覆盖全面: 客户跟进/项目超期/待审批/超期任务/质量问题/缺卡/停滞项目
支持角色区分: 管理员看全team，工人看个人任务+打卡
"""
import json
import logging
from datetime import datetime, date, timezone

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from services.biz_flow import scan_stale_customers, scan_stale_suppliers, scan_stale_projects

logger = logging.getLogger("lingjing.todo")


async def generate_todos(tenant_id: str, industry: str, user_id: str | None = None):
    """自动扫描并生成全体待办（去重：已有同 ref 的 pending 项则跳过）"""
    now = datetime.now(timezone.utc)

    # 1. 客户跟进提醒
    try:
        customer_alerts = await scan_stale_customers(tenant_id, industry)
        for a in customer_alerts:
            exists = await _exists(tenant_id, "customer_stale", a["customer_id"])
            if exists:
                continue
            await _insert(
                tenant_id=tenant_id,
                user_id=None,
                type="customer_stale",
                title=a["message"],
                detail=json.dumps({"customer_id": a["customer_id"], "stage": a["stage"], "days": a["days_stale"]}, ensure_ascii=False),
                ref_type="customer", ref_id=a["customer_id"],
                priority=min(90, 50 + a["days_stale"] * 5),
            )
    except Exception as e:
        logger.warning(f"生成客户待办失败: {e}")

    # 1.5. 供应商跟进提醒
    try:
        supplier_alerts = await scan_stale_suppliers(tenant_id, industry)
        for a in supplier_alerts:
            exists = await _exists(tenant_id, "supplier_stale", a["supplier_id"])
            if exists:
                continue
            await _insert(
                tenant_id=tenant_id,
                user_id=None,
                type="supplier_stale",
                title=a["message"],
                detail=json.dumps({"supplier_id": a["supplier_id"], "stage": a["stage"], "days": a["days_stale"]}, ensure_ascii=False),
                ref_type="supplier", ref_id=a["supplier_id"],
                priority=min(80, 40 + a["days_stale"] * 4),
            )
    except Exception as e:
        logger.warning(f"生成供应商待办失败: {e}")

    # 2. 项目超期/停滞
    try:
        project_alerts = await scan_stale_projects(tenant_id, industry)
        for a in project_alerts:
            exists = await _exists(tenant_id, a["type"], a.get("project_id"))
            if exists:
                continue
            priority = 95 if a["type"] == "project_overdue" else 70
            await _insert(
                tenant_id=tenant_id, user_id=None,
                type=a["type"],
                title=a["message"],
                detail=json.dumps({"project_id": a.get("project_id"), "days": a.get("days_overdue", a.get("days_stale"))}, ensure_ascii=False),
                ref_type="project", ref_id=a.get("project_id"),
                priority=priority,
            )
    except Exception as e:
        logger.warning(f"生成项目待办失败: {e}")

    # 3. 待审批项
    try:
        async with database.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, type, amount, applicant_name, reason, created_at
                   FROM biz_finance WHERE tenant_id=$1 AND status='pending'
                   ORDER BY created_at DESC LIMIT 20""",
                tenant_id,
            )
        for r in rows:
            exists = await _exists(tenant_id, "approval_pending", r["id"])
            if exists:
                continue
            type_cn = {"expense": "费用", "fund_application": "备用金", "wage": "工资"}.get(r["type"], r["type"])
            title = f"{r['applicant_name']} 的{type_cn}申请 \u00a5{float(r['amount']):,.0f} 待审批"
            hours_waiting = (now - r["created_at"]).total_seconds() / 3600 if r["created_at"] else 0
            await _insert(
                tenant_id=tenant_id, user_id=None,
                type="approval_pending",
                title=title,
                detail=json.dumps({
                    "finance_id": r["id"], "amount": float(r["amount"]),
                    "applicant": r["applicant_name"], "reason": r["reason"],
                    "hours_waiting": round(hours_waiting, 1),
                }, ensure_ascii=False),
                ref_type="finance", ref_id=r["id"],
                priority=min(100, 80 + int(hours_waiting / 12)),
            )
    except Exception as e:
        logger.warning(f"生成审批待办失败: {e}")

    # 4. 超期未完成任务
    try:
        async with database.pool.acquire() as conn:
            overdue = await conn.fetch(
                """SELECT id, title, assignee_id, due_date,
                          CURRENT_DATE - due_date AS days_overdue
                   FROM tasks
                   WHERE tenant_id=$1 AND due_date IS NOT NULL AND due_date < CURRENT_DATE
                     AND task_status NOT IN ('completed', 'delayed')
                     AND record_status='active'
                   ORDER BY due_date ASC LIMIT 20""",
                tenant_id,
            )
        for t in overdue:
            exists = await _exists(tenant_id, "task_overdue", t["id"])
            if exists:
                continue
            days = t["days_overdue"]
            await _insert(
                tenant_id=tenant_id, user_id=t["assignee_id"],
                type="task_overdue",
                title=f"任务超期: {t['title']} (超{days}天)",
                detail=json.dumps({"task_id": t["id"], "days_overdue": days, "assignee": t["assignee_id"]}, ensure_ascii=False),
                ref_type="task", ref_id=t["id"],
                priority=min(100, 75 + days * 5),
            )
    except Exception as e:
        logger.warning(f"生成超期任务待办失败: {e}")

    # 5. 质量问题
    try:
        async with database.pool.acquire() as conn:
            unqualified = await conn.fetch(
                """SELECT id, notes, created_at FROM sample_records
                   WHERE tenant_id=$1 AND status='unqualified' AND created_at > NOW() - INTERVAL '7 days'
                   ORDER BY created_at DESC LIMIT 10""",
                tenant_id,
            )
        for s in unqualified:
            exists = await _exists(tenant_id, "quality_issue", s["id"])
            if exists:
                continue
            content = (s["notes"] or "")[:80]
            await _insert(
                tenant_id=tenant_id, user_id=None,
                type="quality_issue",
                title=f"不合格样板: {content}",
                detail=json.dumps({"sample_id": s["id"], "content": content}, ensure_ascii=False),
                ref_type="sample", ref_id=s["id"],
                priority=80,
            )
    except Exception as e:
        logger.warning(f"生成质量问题待办失败: {e}")

    # 6. 停滞项目
    try:
        async with database.pool.acquire() as conn:
            stale_projects = await conn.fetch(
                """SELECT id, name, project_status, updated_at,
                          EXTRACT(DAY FROM (NOW() - updated_at))::int AS days_stale
                   FROM projects
                   WHERE tenant_id=$1 AND deleted_at IS NULL
                     AND project_status NOT IN ('completed', 'paused')
                     AND updated_at < NOW() - INTERVAL '14 days'
                   ORDER BY updated_at ASC LIMIT 10""",
                tenant_id,
            )
        for p in stale_projects:
            exists = await _exists(tenant_id, "stale_project", p["id"])
            if exists:
                continue
            days = p["days_stale"]
            await _insert(
                tenant_id=tenant_id, user_id=None,
                type="stale_project",
                title=f"项目「{p['name']}」已{days}天未更新",
                detail=json.dumps({"project_id": p["id"], "status": p["project_status"], "days_stale": days}, ensure_ascii=False),
                ref_type="project", ref_id=p["id"],
                priority=min(95, 60 + days),
            )
    except Exception as e:
        logger.warning(f"生成停滞项目待办失败: {e}")

    logger.info(f"待办生成完成: tenant={tenant_id}")


async def generate_todos_for_user(tenant_id: str, user_id: str) -> list[dict]:
    """为特定用户生成个人待办 (工人/PM专属)"""
    generated = []
    today = date.today()

    async with database.pool.acquire() as conn:
        # 1. 被分配的任务
        tasks = await conn.fetch(
            """SELECT id, title, due_date, task_status, project_id
               FROM tasks WHERE tenant_id=$1 AND assignee_id=$2
                 AND task_status NOT IN ('completed', 'delayed')
                 AND record_status='active'
               ORDER BY due_date ASC NULLS LAST LIMIT 10""",
            tenant_id, user_id,
        )
        for t in tasks:
            if await _exists(tenant_id, "my_task", t["id"]):
                continue
            days_info = ""
            if t["due_date"]:
                d = (t["due_date"] - today).days
                if d < 0:
                    days_info = f" 已超期{-d}天"
                elif d <= 3:
                    days_info = f" 还剩{d}天"
            await _insert(
                tenant_id=tenant_id, user_id=user_id,
                type="my_task",
                title=f"\U0001f4cb {t['title']}{days_info}",
                detail=json.dumps({"task_id": t["id"], "status": t["task_status"]}, ensure_ascii=False),
                ref_type="task", ref_id=t["id"],
                priority=85 if t["due_date"] and t["due_date"] < today else 65,
            )
            generated.append({"type": "my_task", "title": t["title"]})

        # 2. 今日缺卡提醒 (针对工人)
        role_row = await conn.fetchrow(
            "SELECT role FROM tenant_users WHERE tenant_id=$1 AND user_id=$2",
            tenant_id, user_id,
        )
        user_role = role_row["role"] if role_row else "worker"

        if user_role == "worker":
            checked_today = await conn.fetchval(
                """SELECT count(*) FROM attendance
                   WHERE user_id::text = $1 AND check_time::date = $2""",
                user_id, today.isoformat(),
            )
            if not checked_today:
                already = await conn.fetchval(
                    "SELECT count(*) FROM todo_items WHERE tenant_id=$1 AND type='checkin_missing' AND user_id=$2 AND created_at::date=$3 AND status='pending'",
                    tenant_id, user_id, today.isoformat(),
                )
                if not already:
                    await _insert(
                        tenant_id=tenant_id, user_id=user_id,
                        type="checkin_missing",
                        title="\u23f0 今日还没有打卡签到",
                        detail=json.dumps({"date": today.isoformat()}, ensure_ascii=False),
                        ref_type="attendance", ref_id=0,
                        priority=70,
                    )
                    generated.append({"type": "checkin_missing", "title": "今日打卡"})

        # 3. 审批被驳回
        try:
            applicant_name = await conn.fetchval(
                "SELECT name FROM tenant_users WHERE user_id=$1 AND tenant_id=$2 LIMIT 1",
                user_id, tenant_id,
            )
            if applicant_name:
                rejected = await conn.fetch(
                    """SELECT id, type, amount, updated_at FROM biz_finance
                       WHERE tenant_id=$1 AND applicant_name=$2
                         AND status='rejected' AND updated_at > NOW() - INTERVAL '3 days'
                       LIMIT 5""",
                    tenant_id, applicant_name,
                )
                for r in rejected:
                    if await _exists(tenant_id, "approval_rejected_my", r["id"]):
                        continue
                    type_cn = {"expense": "报销", "fund_application": "备用金", "wage": "工资"}.get(r["type"], r["type"])
                    await _insert(
                        tenant_id=tenant_id, user_id=user_id,
                        type="approval_rejected_my",
                        title=f"你的{type_cn}申请已被驳回 (\u00a5{float(r['amount']):,.0f})",
                        detail=json.dumps({"finance_id": r["id"], "type": r["type"]}, ensure_ascii=False),
                        ref_type="finance", ref_id=r["id"],
                        priority=90,
                    )
                    generated.append({"type": "approval_rejected_my", "title": f"驳回: {type_cn}"})
        except Exception as e:
            logger.warning(f"生成驳回待办失败: {e}")

    return generated


async def _exists(tenant_id: str, ref_type: str, ref_id: int | None) -> bool:
    async with database.pool.acquire() as conn:
        cnt = await conn.fetchval(
            "SELECT count(*) FROM todo_items WHERE tenant_id=$1 AND type=$2 AND ref_id IS NOT DISTINCT FROM $3 AND status='pending'",
            tenant_id, ref_type, ref_id,
        )
        return cnt > 0


async def _insert(**kw):
    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO todo_items (tenant_id, user_id, type, title, detail, ref_type, ref_id, priority, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')""",
            kw["tenant_id"], kw.get("user_id"), kw["type"], kw["title"],
            kw.get("detail", ""), kw.get("ref_type"), kw.get("ref_id"), kw.get("priority", 50),
        )


async def get_todos(tenant_id: str, limit: int = 30, user_id: str | None = None, status: str = "pending",
                   user_role: str = "") -> list[dict]:
    """获取待办列表 (支持按 user_id 筛选个人待办, user_role 过滤审批待办)
    
    角色过滤规则:
    - worker: 仅显示打卡待办 (checkin_missing)
    - 其他非管理员: 显示个人待办, 不显示审批待办
    - owner/admin/super_admin: 显示全部待办
    """
    ADMIN_ROLES = ("owner", "admin", "super_admin")
    conditions = ["tenant_id=$1", "status=$2"]
    params: list = [tenant_id, status]
    idx = 3

    # 工人角色：仅显示未打卡待办
    if user_role == "worker":
        conditions.append("type = 'checkin_missing'")
    else:
        if user_id:
            conditions.append(f"(user_id IS NULL OR user_id=${idx})")
            params.append(user_id)
            idx += 1
        # 非管理员角色不显示审批待办 (approval_pending)
        if user_role and user_role not in ADMIN_ROLES:
            conditions.append("type != 'approval_pending'")
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            f"""SELECT id, type, title, detail, ref_type, ref_id, priority, user_id, created_at
                FROM todo_items WHERE {' AND '.join(conditions)}
                ORDER BY priority DESC, created_at DESC LIMIT {limit}""",
            *params,
        )
    return [
        {"id": r["id"], "type": r["type"], "title": r["title"],
         "detail": json.loads(r["detail"]) if isinstance(r["detail"], str) else (r["detail"] or {}),
         "ref_type": r["ref_type"], "ref_id": r["ref_id"],
         "priority": r["priority"], "user_id": r["user_id"],
         "created_at": r["created_at"].isoformat()}
        for r in rows
    ]


async def mark_done(todo_id: int, tenant_id: str, done_by: str = "") -> dict | None:
    """标记待办为已完成"""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, title, ref_type, ref_id FROM todo_items WHERE id=$1 AND tenant_id=$2",
            todo_id, tenant_id,
        )
        if not row:
            return None
        await conn.execute(
            "UPDATE todo_items SET status='done', done_at=NOW(), done_by=$3 WHERE id=$1 AND tenant_id=$2",
            todo_id, tenant_id, done_by,
        )
        return {"id": row["id"], "title": row["title"], "ref_type": row["ref_type"], "ref_id": row["ref_id"]}


async def get_welcome_todos(tenant_id: str, user_role: str = "") -> list[str]:
    """获取待办摘要文本（欢迎页/上下文注入用）"""
    todos = await get_todos(tenant_id, limit=5, user_role=user_role)
    lines = []
    for t in todos:
        lines.append(f"\u00b7 {t['title']}（ID:{t['id']}）")
    return lines
