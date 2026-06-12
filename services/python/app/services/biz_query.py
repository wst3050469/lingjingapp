"""
灵境AI业务管家 - 业务数据查询服务（多租户版）
检测用户对话中的业务意图，从数据库查询相关数据，注入AI上下文
"""
import json
import re
import logging
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

logger = logging.getLogger("lingjing.biz_query")


# ============================================================
# 查询权限映射
# ============================================================

_QUERY_PERMISSIONS = {
    "owner":           {"*"},
    "admin":           {"*"},
    "project_manager": {
        "project_overview", "project_detail", "attendance", "quality",
        "finance", "process", "approval", "alert", "dashboard",
        "wage", "team_members", "supplier", "recipe", "sample",
        "customer", "my_expense", "wechat_messages",
    },
    "member":          set(),
}


def _get_user_project_id(user: dict | None) -> int | None:
    """从 user dict 中提取绑定的 project_id（由 get_business_context 预填充）"""
    if not user:
        return None
    return user.get("_bound_project_id")


# 业务意图关键词匹配（通用，不含特定项目名）
INTENT_PATTERNS = {
    "project_overview": {
        "keywords": ["项目", "工程", "工地", "进展", "进度", "概况"],
        "query_fn": "_query_projects",
    },
    "project_detail": {
        "keywords": [],  # 动态匹配，由 _detect_project_mention 处理
        "query_fn": "_query_project_detail",
    },
    "attendance": {
        "keywords": ["考勤", "打卡", "签到", "出勤", "谁在", "到岗"],
        "query_fn": "_query_attendance",
    },
    "quality": {
        "keywords": ["质检", "质量", "检查", "返工", "整改", "裂缝"],
        "query_fn": "_query_quality",
    },
    "finance": {
        "keywords": ["资金", "费用", "财务", "花了多少", "成本", "开支", "报销", "款项"],
        "query_fn": "_query_finance",
    },
    "process": {
        "keywords": ["工序", "施工", "打磨", "面层", "基层", "砂浆", "养护"],
        "query_fn": "_query_processes",
    },
    "approval": {
        "keywords": ["审批", "批准", "申请", "拒绝"],
        "query_fn": "_query_approvals",
    },
    "alert": {
        "keywords": ["预警", "警告", "风险", "异常", "问题"],
        "query_fn": "_query_alerts",
    },
    "customer": {
        "keywords": ["客户", "甲方", "合作方"],
        "query_fn": "_query_customers",
    },
    "supplier": {
        "keywords": ["供应商", "材料商", "供货商", "采购", "找谁买", "谁供的", "哪家供"],
        "query_fn": "_query_suppliers",
    },
    "contract": {
        "keywords": ["合同", "签约", "签订", "合同额"],
        "query_fn": "_query_contracts",
    },
    "material": {
        "keywords": ["物料", "材料", "建材"],
        "query_fn": "_query_not_implemented",
    },
    "equipment": {
        "keywords": ["设备", "机械", " machinery"],
        "query_fn": "_query_not_implemented",
    },
    "payment": {
        "keywords": ["收款", "回款", "收款记录"],
        "query_fn": "_query_payments",
    },
    "my_expense": {
        "keywords": ["我的采购", "我采购", "我买了", "我花的钱", "我的支出", "我付了", "我花了"],
        "query_fn": "_query_my_expenses",
    },
    "invoice": {
        "keywords": ["发票", "开票", "发票记录", "发票查询", "查发票"],
        "query_fn": "_query_invoices",
    },
    "change_order": {
        "keywords": ["增项", "变更", "签证", "设计变更"],
        "query_fn": "_query_not_implemented",
    },
    "worker_monitor": {
        "keywords": ["工人监控", "人员监控", "工人位置"],
        "query_fn": "_query_not_implemented",
    },
    "overtime": {
        "keywords": ["加班", "加班管理", "加班记录"],
        "query_fn": "_query_not_implemented",
    },
    "material_calculation": {
        "keywords": ["材料计算", "算量", "材料用量", "工程量计算"],
        "query_fn": "_query_not_implemented",
    },
    "dashboard": {
        "keywords": ["汇报", "总结", "整体", "全局", "情况怎么样", "怎么样了"],
        "query_fn": "_query_dashboard",
    },
    "wage": {
        "keywords": ["工资", "薪资", "月薪", "工钱", "多少钱", "工资单", "发工资", "算工资"],
        "query_fn": "_query_wages",
    },
    "team_members": {
        "keywords": ["团队", "成员", "员工", "谁是", "人员", "项目经理", "管理员", "技术员", "工人", "老板"],
        "query_fn": "_query_team_members",
    },
    "recipe": {
        "keywords": ["配方", "工艺", "配比", "怎么做", "怎么配", "成分", "原料", "步骤", "curing", "养护"],
        "query_fn": "_query_recipes",
    },
    "sample": {
        "keywords": ["样板", "样板间", "样图", "样品", "打样", "采样", "样板管理", "样板记录", "样板历史"],
        "query_fn": "_query_samples",
    },
    "wechat_messages": {
        "keywords": ["微信消息", "群聊", "微信记录", "聊天记录", "消息归类", "群消息", "微信分析结果"],
        "query_fn": "_query_wechat_messages",
    },
}


def detect_business_intent(message: str) -> list[str]:
    """从用户消息中检测业务意图，返回匹配的意图列表"""
    intents = []
    msg_lower = message.lower()
    for intent, config in INTENT_PATTERNS.items():
        if not config["keywords"]:
            continue
        for kw in config["keywords"]:
            if kw in msg_lower:
                intents.append(intent)
                break

    # 防误触发：如果消息是在查特定角色的人（项目经理/管理员/技术员/工人），
    # 即使包含"项目"（在"项目经理"里），也不要触发 project_overview
    _ROLE_QUERY_KWS = ["项目经理", "管理员", "技术员", "工人"]
    if "team_members" in intents and "project_overview" in intents:
        has_role_query = any(kw in msg_lower for kw in _ROLE_QUERY_KWS)
        if has_role_query:
            intents.remove("project_overview")

    return intents


async def _resolve_project(conn, tenant_id: str, message: str) -> dict | None:
    """从消息中动态匹配租户的项目（按名称、地点子串匹配）"""
    rows = await conn.fetch(
        "SELECT id, ext_id, name, location FROM biz_projects WHERE tenant_id=$1",
        tenant_id,
    )
    for r in rows:
        if r["name"] and r["name"] in message:
            return dict(r)
        if r["location"]:
            # 按城市名/地点子串匹配
            for seg in r["location"].replace("省", " ").replace("市", " ").replace("区", " ").split():
                if len(seg) >= 2 and seg in message:
                    return dict(r)
    return None


async def _query_projects(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询项目概览（PM仅看自己管理的项目）"""
    user = kwargs.get("user")
    role = (user or {}).get("tenant_role") or "member"

    rows = await conn.fetch(
        "SELECT id, name, progress, status, contract_amount, actual_cost, location, manager_name, manager_user_id FROM biz_projects WHERE tenant_id=$1 ORDER BY id",
        tenant_id,
    )

    if not rows:
        return "当前没有进行中的项目。"

    # PM: 仅看绑定的项目
    if role == "project_manager":
        pm_project_id = _get_user_project_id(user)
        if pm_project_id:
            rows = [r for r in rows if r["id"] == pm_project_id]
        else:
            username = (user or {}).get("code", "").replace("u_", "")
            rows = [r for r in rows if r["manager_user_id"] == username]

    if not rows:
        return "您当前没有管理的项目。"
    lines = ["当前项目概览:"]
    total_amount = 0
    total_cost = 0
    for r in rows:
        status_zh = {"in_progress": "进行中", "completed": "已完成", "paused": "暂停"}.get(r["status"], r["status"])
        remaining = float(r["contract_amount"] or 0) - float(r["actual_cost"] or 0)
        remain_str = f" 剩余¥{remaining:,.0f}"
        if remaining < 0: remain_str += " ⚠️超预算"
        lines.append(f"  - {r['name']}: 进度{r['progress']}%, {status_zh}, 合同额¥{r['contract_amount']:,.0f}, 已支出¥{r['actual_cost']:,.0f}{remain_str}, 项目经理:{r['manager_name']}")
        total_amount += float(r["contract_amount"] or 0)
        total_cost += float(r["actual_cost"] or 0)
    lines.append(f"  合计{len(rows)}个项目, 总合同额¥{total_amount:,.0f}, 总支出¥{total_cost:,.0f}, 总剩余¥{total_amount-total_cost:,.0f}")
    return "\n".join(lines)


async def _query_project_detail(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询单个项目详情（PM仅看自己管理的项目）"""
    user = kwargs.get("user")
    role = (user or {}).get("tenant_role") or "member"

    proj = await _resolve_project(conn, tenant_id, message)

    # PM: 限制只能看绑定的项目
    if role == "project_manager":
        pm_project_id = _get_user_project_id(user)
        if proj and pm_project_id and proj["id"] != pm_project_id:
            return "您没有权限查看该项目的详情。"
        if not proj and pm_project_id:
            proj = {"id": pm_project_id}

    if not proj:
        return await _query_projects(conn, message, tenant_id, **kwargs)

    p = await conn.fetchrow(
        "SELECT * FROM biz_projects WHERE id=$1", proj["id"],
    )
    if not p:
        return "未找到该项目。"

    cfg = json.loads(p["config"]) if isinstance(p["config"], str) else (p["config"] or {})
    lines = [
        f"项目: {p['name']}",
        f"  甲方: {p['customer']}",
        f"  项目经理: {p['manager_name'] or '未指定'}",
        f"  进度: {p['progress']}%",
        f"  合同额: ¥{p['contract_amount']:,.0f}",
        f"  已支出: ¥{p['actual_cost']:,.0f}",
    ]
    remaining = float(p['contract_amount'] or 0) - float(p['actual_cost'] or 0)
    remain_str = f"  剩余: ¥{remaining:,.0f}"
    if remaining < 0: remain_str += " ⚠️已超预算！"
    lines.append(remain_str)
    lines += [
        f"  地点: {p['location']}",
        f"  面积: {cfg.get('area', '未知')}㎡",
        f"  编号: {cfg.get('project_no', '')}",
    ]

    # ── 客户详情 ──
    if p['customer'] and len(p['customer']) >= 1:
        cust = await conn.fetchrow(
            "SELECT name, contact_person, phone, status FROM biz_customers WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1",
            tenant_id, f"%{p['customer']}%",
        )
        if cust:
            status_cn = {"lead":"潜在","contacted":"已联系","quoting":"报价中","negotiating":"谈判中","signed":"已签约","lost":"已流失"}.get(cust['status'], cust['status'])
            lines.append(f"  客户详情: {cust['contact_person']} {cust['phone']} ({status_cn})")

    # ── 关联工人 ──
    workers = await conn.fetch(
        """SELECT tu.user_id, tu.name, tu.role, tu.ext_data FROM tenant_users tu
           WHERE tu.tenant_id=$1 AND tu.ext_data::jsonb ? 'project_id'""",
        tenant_id,
    )
    bound_workers = []
    for w in workers:
        ext = json.loads(w["ext_data"]) if isinstance(w["ext_data"], str) else (w.get("ext_data") or {})
        if ext.get("project_id") == p["id"]:
            wtype = ext.get("worker_type", "")
            wage = ext.get("daily_wage", "")
            info = w["name"]
            if wtype: info += f"({wtype})"
            if wage: info += f" 日薪{wage}元"
            bound_workers.append(info)
    if bound_workers:
        lines.append(f"  工人({len(bound_workers)}人): " + "、".join(bound_workers))
    else:
        lines.append("  工人: 尚未绑定工人")

    # ── 关联样板 ──
    samples = await conn.fetch(
        """SELECT id, recipe_name, customer_name, specification, status, file_ids, image_url
           FROM sample_records WHERE tenant_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 10""",
        tenant_id, p["id"],
    )
    if samples:
        lines.append(f"  关联样板({len(samples)}条):")
        for s in samples:
            info = f"    #{s['id']}"
            if s.get("recipe_name"): info += f" [{s['recipe_name']}]"
            if s.get("specification"): info += f" {s['specification']}"
            sn = {"completed":"已完成","drafted":"草稿","sent_to_factory":"已发工厂"}.get(s.get("status",""), s.get("status",""))
            info += f" ({sn})"
            file_ids = s.get("file_ids")
            if file_ids:
                if isinstance(file_ids, str):
                    try: file_ids = json.loads(file_ids)
                    except (json.JSONDecodeError, TypeError): file_ids = []
                if file_ids:
                    info += f" 📷×{len(file_ids)}"
            elif s.get("image_url"):
                info += " 📷"
            lines.append(info)
    else:
        lines.append("  关联样板: 无")

    # ── 工序进展 ──

    procs = await conn.fetch(
        "SELECT name, stage, progress, status FROM biz_processes WHERE project_id=$1 ORDER BY sort_order",
        p["id"],
    )
    if procs:
        lines.append("  工序进展:")
        for pr in procs:
            status_zh = {"completed": "已完成", "in_progress": "进行中", "pending": "待开始"}.get(pr["status"], pr["status"])
            lines.append(f"    - {pr['name'] or pr['stage']}: {pr['progress']}% ({status_zh})")

    att_count = await conn.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM biz_attendance WHERE project_id=$1 AND type='check_in' AND check_time > NOW() - interval '7 days'",
        p["id"],
    )
    lines.append(f"  近7天打卡人数: {att_count}人")

    qi = await conn.fetch(
        "SELECT inspection_type, result, inspection_date, inspector_name FROM biz_quality_inspections WHERE project_id=$1 ORDER BY inspection_date DESC LIMIT 3",
        p["id"],
    )
    if qi:
        lines.append("  最近质检:")
        for q in qi:
            lines.append(f"    - {q['inspection_date']}: {q['inspection_type']} ({q['result']}) by {q['inspector_name']}")

    return "\n".join(lines)


async def _query_attendance(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询考勤数据（worker仅自己，PM仅本项目）"""
    user = kwargs.get("user")
    role = (user or {}).get("tenant_role") or "member"

    # worker: 只查自己的打卡
    if role == "worker":
        username = (user or {}).get("code", "").replace("u_", "")
        if not username:
            return "无法识别您的身份。"
        rows = await conn.fetch("""
            SELECT user_name, type, check_time, address, ba.project_id, bp.name as project
            FROM biz_attendance ba
            LEFT JOIN biz_projects bp ON bp.id = ba.project_id
            WHERE ba.tenant_id=$1 AND ba.user_id=$2
            ORDER BY ba.check_time DESC LIMIT 20
        """, tenant_id, username)
        if not rows:
            return "您最近没有打卡记录。"
        lines = ["您的考勤记录(最近20条):"]
        for r in rows:
            t = "签到" if r["type"] == "check_in" else "签退"
            lines.append(f"  {t} {str(r['check_time'])[:16]} {r.get('project') or ''} {r['address']}")
        return "\n".join(lines)

    # project_manager: 只查绑定项目的考勤
    if role == "project_manager":
        pm_project_id = _get_user_project_id(user)
        if pm_project_id:
            rows = await conn.fetch("""
                SELECT user_name, type, check_time, address
                FROM biz_attendance WHERE tenant_id=$1 AND project_id=$2
                ORDER BY check_time DESC LIMIT 20
            """, tenant_id, pm_project_id)
            proj_name = await conn.fetchval("SELECT name FROM biz_projects WHERE id=$1", pm_project_id)
            lines = [f"{proj_name or '本项目'} 考勤记录(最近20条):"]
            for r in rows:
                t = "签到" if r["type"] == "check_in" else "签退"
                lines.append(f"  {r['user_name']} {t} {str(r['check_time'])[:16]} {r['address']}")
            return "\n".join(lines)

    # admin/owner: 原有逻辑
    proj = await _resolve_project(conn, tenant_id, message)
    if proj:
        rows = await conn.fetch("""
            SELECT user_name, type, check_time, address
            FROM biz_attendance WHERE tenant_id=$1 AND project_id=$2
            ORDER BY check_time DESC LIMIT 20
        """, tenant_id, proj["id"])
        lines = [f"{proj['name']} 考勤记录(最近20条):"]
        for r in rows:
            t = "签到" if r["type"] == "check_in" else "签退"
            lines.append(f"  {r['user_name']} {t} {str(r['check_time'])[:16]} {r['address']}")
        return "\n".join(lines)

    summary = await conn.fetch("""
        SELECT bp.name as project, COUNT(DISTINCT ba.user_id) as workers,
               COUNT(*) FILTER (WHERE ba.type='check_in') as checkins
        FROM biz_attendance ba
        JOIN biz_projects bp ON bp.id = ba.project_id
        WHERE ba.tenant_id=$1 AND ba.check_time > NOW() - interval '7 days'
        GROUP BY bp.name
    """, tenant_id)
    if not summary:
        return "最近7天没有考勤记录。"
    lines = ["近7天考勤概览:"]
    for s in summary:
        lines.append(f"  {s['project']}: {s['workers']}人打卡, {s['checkins']}次签到")
    return "\n".join(lines)


async def _query_quality(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询质检数据"""
    rows = await conn.fetch("""
        SELECT bq.inspection_type, bq.result, bq.inspection_date, bq.inspector_name,
               bq.issues, bq.rectification_required, bp.name as project
        FROM biz_quality_inspections bq
        JOIN biz_projects bp ON bp.id = bq.project_id
        WHERE bq.tenant_id=$1
        ORDER BY bq.inspection_date DESC LIMIT 10
    """, tenant_id)
    if not rows:
        return "暂无质检记录。"
    lines = ["质检记录:"]
    for r in rows:
        result_zh = {"pass": "合格", "fail": "不合格", "pending": "待检"}.get(r["result"], r["result"])
        lines.append(f"  {r['inspection_date']} [{r['project']}] {r['inspection_type']} - {result_zh} (检查人:{r['inspector_name']})")
        if r["issues"]:
            lines.append(f"    问题: {r['issues'][:100]}")
    return "\n".join(lines)


async def _query_finance(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询财务数据（PM仅本项目，且不暴露待审批项）"""
    user = kwargs.get("user")
    role = (user or {}).get("tenant_role") or "member"

    # PM: 仅看本项目财务，且不暴露等待管理员审批的项
    project_filter = ""
    pending_filter = ""
    params_summary: list = [tenant_id]
    params_recent: list = [tenant_id]
    if role == "project_manager":
        pm_project_id = _get_user_project_id(user)
        pm_name = (user or {}).get("nickname") or ""
        if pm_project_id:
            project_filter = " AND bf.project_id=$2"
            params_summary.append(pm_project_id)
            params_recent.append(pm_project_id)
        # PM 只看到自己提交的 + 已处理的（非 pending），隐藏他人的待审批项
        pending_filter = " AND (bf.status != 'pending' OR bf.applicant_name = $3)"
        params_summary.append(pm_name)
        params_recent.append(pm_name)

    summary = await conn.fetch(f"""
        SELECT COALESCE(bp.name, '未关联项目') as project,
               COALESCE(SUM(CASE WHEN bf.type IN ('expense','fund_application','wage')
                 AND (bf.status != 'pending' OR bf.applicant_name = ${len(params_summary)}) THEN bf.amount ELSE 0 END), 0) as total_expense,
               COALESCE(SUM(CASE WHEN bf.type='income' THEN bf.amount ELSE 0 END), 0) as total_income,
               COUNT(*) as records
        FROM biz_finance bf
        LEFT JOIN biz_projects bp ON bp.id = bf.project_id
        WHERE bf.tenant_id=$1{project_filter}{pending_filter}
        GROUP BY bp.name
    """, *params_summary)

    recent = await conn.fetch(f"""
        SELECT bf.id, bf.type, bf.category, bf.amount, bf.applicant_name, bf.status,
               bf.reason, bp.name as project, bf.created_at,
               bf.file_ids, bf.supplier_name, bf.material_desc
        FROM biz_finance bf
        LEFT JOIN biz_projects bp ON bp.id = bf.project_id
        WHERE bf.tenant_id=$1{project_filter}{pending_filter}
        ORDER BY bf.created_at DESC LIMIT 10
    """, *params_recent)

    # ✅ 公司款项和工人款项分开显示，不混合
    lines = ["财务概况:"]
    if summary:
        for s in summary:
            lines.append(f"  {s['project']}: 支出¥{s['total_expense']:,.0f} 收入¥{s['total_income']:,.0f} ({s['records']}笔)")
    if recent:
        # 分离公司收支和工人相关
        company_items = [r for r in recent if r["type"] in ("expense", "income")]
        worker_items = [r for r in recent if r["type"] in ("fund_application", "wage")]
        if company_items:
            lines.append("【公司收支】:")
            for r in company_items:
                type_zh = {"expense": "支出", "income": "收入"}.get(r["type"], r["type"])
                line = f"  ¥{r['amount']:,.0f} {type_zh} {r['applicant_name']} ({r['project'] or '未关联项目'})"
                if r.get("supplier_name"):
                    line += f" 供应商:{r['supplier_name']}"
                if r.get("material_desc"):
                    line += f" 材料:{r['material_desc'][:30]}"
                line += f" - {r['reason'][:30]}"
                file_ids = r.get("file_ids")
                if file_ids:
                    if isinstance(file_ids, str):
                        file_ids = json.loads(file_ids)
                    if file_ids and isinstance(file_ids, list) and len(file_ids) > 0:
                        line += f" [有{len(file_ids)}张单据图片]"
                lines.append(line)
        if worker_items:
            lines.append("【工人请款/工资】:")
            for r in worker_items:
                type_zh = {"fund_application": "备用金申请", "wage": "工资"}.get(r["type"], r["type"])
                line = f"  ¥{r['amount']:,.0f} {type_zh} {r['applicant_name']} ({r['project'] or '未关联项目'})"
                if r.get("status") == "pending":
                    line += " [等待管理员审批]"
                line += f" - {r['reason'][:30]}"
                lines.append(line)
        if not company_items and not worker_items:
            lines.append("  暂无交易记录")
    return "\n".join(lines)


async def _query_processes(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询工序进展"""
    proj = await _resolve_project(conn, tenant_id, message)
    where = "WHERE bp.tenant_id=$1"
    params: list = [tenant_id]
    if proj:
        where += " AND bp.id=$2"
        params.append(proj["id"])

    rows = await conn.fetch(f"""
        SELECT bpr.name, bpr.stage, bpr.progress, bpr.status,
               bpr.planned_start, bpr.planned_end, bpr.actual_start, bpr.actual_end,
               bpr.responsible_name, bp.name as project
        FROM biz_processes bpr
        JOIN biz_projects bp ON bp.id = bpr.project_id
        {where}
        ORDER BY bp.id, bpr.sort_order
    """, *params)
    if not rows:
        return "暂无工序数据。"
    lines = ["工序进展:"]
    cur_project = ""
    for r in rows:
        if r["project"] != cur_project:
            cur_project = r["project"]
            lines.append(f"\n  【{cur_project}】")
        status_zh = {"completed": "已完成", "in_progress": "进行中", "pending": "待开始"}.get(r["status"], r["status"])
        name = r["name"] or r["stage"]
        lines.append(f"    {name}: {r['progress']}% ({status_zh}) 负责人:{r['responsible_name']}")
    return "\n".join(lines)


async def _query_approvals(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询审批记录"""
    rows = await conn.fetch("""
        SELECT aa.applicant_name, aa.approval_type, aa.result, aa.reject_reason,
               aa.created_at, bp.name as project
        FROM ai_approvals aa
        LEFT JOIN biz_projects bp ON bp.id = aa.project_id
        WHERE aa.tenant_id=$1
        ORDER BY aa.created_at DESC LIMIT 10
    """, tenant_id)
    if not rows:
        return "暂无审批记录。"
    lines = ["AI审批记录:"]
    for r in rows:
        result_zh = {"approved": "通过", "rejected": "拒绝", "pending_review": "待确认"}.get(r["result"], r["result"])
        lines.append(f"  {str(r['created_at'])[:16]} [{result_zh}] {r['applicant_name']} - {r['project'] or '未知项目'}")
        if r["reject_reason"]:
            lines.append(f"    拒绝原因: {r['reject_reason'][:80]}")
    return "\n".join(lines)


async def _query_alerts(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询预警"""
    rows = await conn.fetch("""
        SELECT aa.alert_type, aa.severity, aa.title, aa.detail, aa.status,
               aa.created_at, bp.name as project
        FROM ai_alerts aa
        LEFT JOIN biz_projects bp ON bp.id = aa.project_id
        WHERE aa.tenant_id=$1
        ORDER BY aa.created_at DESC LIMIT 10
    """, tenant_id)
    if not rows:
        return "当前没有预警。一切正常。"
    lines = ["预警列表:"]
    for r in rows:
        sev_zh = {"critical": "严重", "warning": "警告", "info": "信息"}.get(r["severity"], r["severity"])
        lines.append(f"  [{sev_zh}] {r['title']} ({r['project'] or '全局'})")
        lines.append(f"    {r['detail'][:100]}")
    return "\n".join(lines)


async def _query_customers(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询客户"""
    rows = await conn.fetch(
        """SELECT bc.id, bc.name, bc.contact_person, bc.phone, bc.company, bc.status,
                  bc.project_status, bc.source, bc.notes, bc.created_at, bc.updated_at,
                  (SELECT count(*) FROM customer_followups cf WHERE cf.customer_id=bc.id) as followup_count,
                  (SELECT cf.content FROM customer_followups cf WHERE cf.customer_id=bc.id ORDER BY cf.created_at DESC LIMIT 1) as last_followup
           FROM biz_customers bc WHERE bc.tenant_id=$1 ORDER BY bc.updated_at DESC""",
        tenant_id,
    )
    if not rows:
        return "暂无客户数据。"
    
    # 优先级排序：高优先级在前
    priority_map = {
        "洽谈中": 1, "已签约": 2, "施工中": 3,
        "待跟进": 4, "咨询中": 5, "已交付": 6, "质保中": 7,
        "休眠客户": 8, "无效客户": 9,
    }
    priority_label = {1: "🔴高", 2: "🔴高", 3: "🔴高", 4: "🟡中", 5: "🟡中", 
                      6: "🟢低", 7: "🟢低", 8: "⚪", 9: "⚪"}
    
    sorted_rows = sorted(rows, key=lambda r: priority_map.get(r["status"], 99))
    
    lines = ["客户列表（按优先级排序）:"]
    for r in sorted_rows:
        pri = priority_map.get(r["status"], 99)
        plabel = priority_label.get(pri, "⚪")
        status_cn = r["status"] or "无状态"
        project_st = f" [{r['project_status']}]" if r.get("project_status") else ""
        created = f" 建档:{r['created_at'].strftime('%m-%d')}" if r.get("created_at") else ""
        company_info = f" {r['company']}" if r.get("company") else ""
        last_follow = f" 最近跟进:{r['last_followup'][:30]}" if r.get("last_followup") else ""
        follow_cnt = f" 跟进{r['followup_count']}次" if r.get("followup_count", 0) > 0 else ""
        
        lines.append(
            f"📇 {r['name']}{company_info}"
            f"\n  {plabel} {status_cn}{project_st}"
            f"\n  📞{r['phone'] or '无电话'} 👤{r['contact_person'] or r['name']}{created}"
            f"{follow_cnt}{last_follow}"
        )
    return "\n".join(lines)


async def _extract_new_suppliers_from_memories(conn, tenant_id: str, existing_suppliers: list) -> str | None:
    """从 entity_facts 提取对话中提及但尚未录入 biz_suppliers 的供应商（去重补充）。
    
    此函数仅返回 biz_suppliers 表中不存在的供应商，确保主源数据稳定。
    """
    # 构建已录入供应商名集合（用于去重）
    existing_names = {r['name'] for r in existing_suppliers if r['name']}
    
    # 查 biz_customers 获取已知客户名（交叉排除）
    customer_rows = await conn.fetch(
        "SELECT name FROM biz_customers WHERE tenant_id=$1",
        tenant_id,
    )
    customer_names = {r['name'] for r in customer_rows} if customer_rows else set()
    
    rows = await conn.fetch("""
        SELECT entity_name, field_name, field_value, confidence
        FROM entity_facts
        WHERE tenant_id=$1 AND entity_type='supplier'
          AND confidence >= 0.7
        ORDER BY entity_name, confidence DESC
    """, tenant_id)
    
    if not rows:
        return None
    
    # 客户/供应商特征关键词
    _customer_keywords = {'建设集团', '建设工程', '项目部', '建设单位'}
    
    entities: dict[str, dict] = {}
    for r in rows:
        name = r['entity_name']
        
        # 去重1：已录入 biz_suppliers 的跳过
        if name in existing_names:
            continue
        # 模糊去重：检查是否与已录入供应商名相似
        is_dup = False
        for ename in existing_names:
            if name in ename or ename in name:
                is_dup = True
                break
        if is_dup:
            continue
        
        # 去重2：排除已知客户
        is_customer = name in customer_names
        if not is_customer:
            for cname in customer_names:
                if cname in name or name in cname:
                    is_customer = True
                    break
        if not is_customer:
            for kw in _customer_keywords:
                if kw in name:
                    is_customer = True
                    break
        if is_customer:
            continue
        
        if name not in entities:
            entities[name] = {'name': name, 'fields': {}}
        field = r['field_name']
        val = r['field_value']
        if field not in entities[name]['fields']:
            entities[name]['fields'][field] = val
    
    if not entities:
        return None
    
    logger.info(f"[entity_facts补充] 从对话记忆中发现 {len(entities)} 家未录入供应商")
    lines = ["📌 对话中提及过但尚未录入系统的供应商："]
    for name, ent in sorted(entities.items()):
        f = ent['fields']
        line = f"  {name}"
        if 'phone' in f:
            line += f"，电话{f['phone']}"
        if 'material_type' in f:
            line += f"，{f['material_type']}供应商"
        if 'contact_person' in f:
            line += f"，联系人{f['contact_person']}"
        if 'price' in f:
            line += f"，{f['price']}"
        if 'notes' in f:
            line += f"。{f['notes'][:100]}"
        lines.append(line)
    lines.append("  💡 如需正式录入，请说「录个供应商叫XX，电话XXX」")
    
    return "\n".join(lines) if len(lines) > 1 else None

async def _query_suppliers(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询供应商：支持按材料筛选、供应商详情、全量列表"""
    from services.biz_actions import _MATERIAL_MAP

    # === 模式1：检查消息中是否提到了具体供应商名 → 展示详情 ===
    all_suppliers = await conn.fetch(
        "SELECT id, name FROM biz_suppliers WHERE tenant_id=$1 AND status NOT IN ('suspended', 'blacklisted', 'terminated')",
        tenant_id,
    )
    target = None
    for s in all_suppliers:
        if s["name"] and (s["name"] in message or message.strip() in s["name"]):
            target = s
            break

    if target:
        logger.info(f"[supplier_query] mode=detail, target={target['name']}, tenant={tenant_id}")
        # 供应商详情
        row = await conn.fetchrow(
            "SELECT name, contact_person, phone, material_type, business_type, address, rating, notes FROM biz_suppliers WHERE id=$1",
            target["id"],
        )
        lines = [f"供应商详情：{row['name']}"]
        if row["material_type"]:
            lines[0] += f"（{row['material_type']}供应商）"
        if row["phone"]:
            lines.append(f"  电话：{row['phone']}")
        if row["contact_person"]:
            lines.append(f"  联系人：{row['contact_person']}")
        if row["business_type"]:
            lines.append(f"  业务类型：{row['business_type']}")
        if row["address"]:
            lines.append(f"  地址：{row['address']}")
        if row["rating"]:
            lines.append(f"  评分：{'★' * row['rating']}")
        if row["notes"]:
            lines.append(f"  备注：{row['notes']}")
        # 产品报价
        products = await conn.fetch(
            "SELECT product_name, spec, unit, unit_price, quoted_at FROM biz_supplier_products WHERE supplier_id=$1 ORDER BY quoted_at DESC",
            target["id"],
        )
        if products:
            lines.append("  产品报价：")
            for p in products:
                price_str = f"¥{p['unit_price']:,.0f}/{p['unit']}" if p["unit"] else f"¥{p['unit_price']:,.0f}"
                date_str = f" ({p['quoted_at']}报价)" if p["quoted_at"] else ""
                spec_str = f" ({p['spec']})" if p["spec"] else ""
                lines.append(f"    - {p['product_name']}{spec_str}: {price_str}{date_str}")
        # 关联采购记录
        purchases = await conn.fetch(
            """SELECT bf.amount, bf.reason, bf.created_at, bp.name as project
               FROM biz_finance bf LEFT JOIN biz_projects bp ON bp.id = bf.project_id
               WHERE bf.supplier_id=$1 AND bf.type='expense'
               ORDER BY bf.created_at DESC LIMIT 10""",
            target["id"],
        )
        if purchases:
            lines.append("  历史采购：")
            for p in purchases:
                proj = p["project"] or "未关联项目"
                lines.append(f"    - {str(p['created_at'])[:10]}: ¥{p['amount']:,.0f}（{proj}）{(p['reason'] or '')[:30]}")
        return "\n".join(lines)

    # === 模式2：从消息中提取材料关键词 → 按材料筛选 ===
    material_filter = None
    for keyword in sorted(_MATERIAL_MAP.keys(), key=len, reverse=True):
        if keyword in message:
            material_filter = _MATERIAL_MAP[keyword]
            break

    if material_filter:
        logger.info(f"[supplier_query] mode=material, filter={material_filter}, tenant={tenant_id}")
        rows = await conn.fetch(
            "SELECT name, phone, material_type, business_type FROM biz_suppliers WHERE tenant_id=$1 AND material_type ILIKE $2 AND status NOT IN ('suspended', 'blacklisted', 'terminated') ORDER BY name",
            tenant_id, f'%{material_filter}%',
        )
        if not rows:
            return f"暂无{material_filter}类供应商。可以对我说「录个供应商叫XX，{material_filter}供应商，电话XXX」来添加。"
        lines = [f"{material_filter}供应商（共{len(rows)}家）:"]
        for r in rows:
            phone_str = f": {r['phone']}" if r["phone"] else ""
            biz_str = f" ({r['business_type']})" if r["business_type"] else ""
            lines.append(f"  - {r['name']}{phone_str}{biz_str}")
        return "\n".join(lines)

    # === 模式3：全量列表（主源：biz_suppliers 表，辅源：entity_facts 去重补充） ===
    logger.info(f"[supplier_query] mode=full_list, tenant={tenant_id}")
    rows = await conn.fetch(
        "SELECT name, phone, material_type, business_type FROM biz_suppliers WHERE tenant_id=$1 AND status NOT IN ('suspended', 'blacklisted', 'terminated') ORDER BY material_type, name",
        tenant_id,
    )

    lines = []
    # 主源：biz_suppliers 结构化数据（稳定）
    if rows:
        groups = {}
        for r in rows:
            cat = r["material_type"] or "未分类"
            groups.setdefault(cat, []).append(r)
        lines.append(f"系统已录入供应商（共{len(rows)}家）:")
        for cat, items in groups.items():
            lines.append(f"  【{cat}】")
            for r in items:
                phone_str = f": {r['phone']}" if r["phone"] else ""
                biz_str = f" ({r['business_type']})" if r["business_type"] else ""
                lines.append(f"    - {r['name']}{phone_str}{biz_str}")

    # 辅源：从 entity_facts 提取对话中提及但尚未录入 biz_suppliers 的供应商
    if tenant_id:
        try:
            mem_suppliers = await _extract_new_suppliers_from_memories(conn, tenant_id, rows)
            if mem_suppliers:
                lines.append("\n" + mem_suppliers)
        except Exception as e:
            logger.warning(f"记忆供应商提取失败: {e}")

    if not lines:
        return "暂无供应商数据。可以对我说「录个供应商叫XX，水泥供应商，电话XXX」来添加。"

    return "\n".join(lines)


async def _query_contracts(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询合同"""
    rows = await conn.fetch(
        "SELECT title, contract_no, party_a, party_b, amount, sign_date, status FROM biz_contracts WHERE tenant_id=$1 ORDER BY sign_date DESC",
        tenant_id,
    )
    if not rows:
        return "暂无合同数据。"
    lines = ["合同列表:"]
    total_amount = 0
    for r in rows:
        status_zh = {"draft": "草稿", "active": "执行中", "completed": "已完成", "terminated": "已终止"}.get(r["status"], r["status"])
        lines.append(f"  {r['title'] or r['contract_no']}: 甲方{r['party_a']} 乙方{r['party_b']} 金额¥{r['amount']:,.0f} 签订日期{r['sign_date']} ({status_zh})")
        total_amount += float(r["amount"] or 0)
    lines.append(f"  合计{len(rows)}份合同, 总金额¥{total_amount:,.0f}")
    return "\n".join(lines)


async def _query_my_expenses(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询本人的采购/费用记录（PM可查看自己提交的）"""
    user = kwargs.get("user", {})
    applicant = user.get("nickname", "") or user.get("name", "")
    if not applicant:
        # fallback: try code
        applicant = user.get("code", "")
    
    rows = await conn.fetch(
        """SELECT bf.id, bf.category, bf.amount, bf.reason, bf.status, bf.created_at,
                  bp.name as project_name, bf.file_ids, bf.supplier_name
           FROM biz_finance bf
           LEFT JOIN biz_projects bp ON bp.id = bf.project_id
           WHERE bf.tenant_id=$1 AND bf.applicant_name=$2 AND bf.type='expense'
           ORDER BY bf.created_at DESC LIMIT 100""",
        tenant_id, applicant,
    )
    if not rows:
        return f"未找到 {applicant} 的采购记录。"
    
    cat_zh = {"原料采购": "原料采购", "零星采购": "零星采购", "临时工零星支付": "临时工零星支付"}
    lines = [f"{applicant} 的采购记录（共{len(rows)}条）:"]
    total = 0
    for r in rows:
        cat = cat_zh.get(r["category"], r["category"])
        line = f"  #{r['id']} ¥{float(r['amount']):,.0f} [{cat}]"
        if r.get("project_name"):
            line += f" 项目:{r['project_name']}"
        if r.get("supplier_name"):
            line += f" 供应商:{r['supplier_name']}"
        line += f" ({r['status']})"
        if r.get("reason"):
            reason_short = r["reason"][:60]
            line += f" {reason_short}"
        lines.append(line)
        total += float(r["amount"])
    lines.append(f"  合计: ¥{total:,.0f}")
    return "\n".join(lines)


async def _query_invoices(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询发票记录，支持按项目筛选"""
    # 检测是否指定项目
    project_filter = None
    for kw in ["项目", "工程"]:
        idx = message.find(kw)
        if idx > 0:
            # 提取项目关键词：项目名通常在"项目/工程"之前或之后
            before = message[max(0,idx-15):idx].strip()
            after = message[idx+len(kw):idx+len(kw)+15].strip()
            candidates = [c for c in [before, after] if c and len(c) >= 2]
            if candidates:
                project_filter = candidates[0]
            break

    if project_filter:
        rows = await conn.fetch(
            """SELECT i.*, bp.name as project_name
               FROM invoices i
               LEFT JOIN biz_projects bp ON bp.id = i.project_id
               WHERE i.tenant_id=$1 AND bp.name ILIKE $2
               ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC LIMIT 50""",
            tenant_id, f'%{project_filter}%',
        )
        title_prefix = f"项目「{project_filter}」"
    else:
        rows = await conn.fetch(
            """SELECT i.*, bp.name as project_name
               FROM invoices i
               LEFT JOIN biz_projects bp ON bp.id = i.project_id
               WHERE i.tenant_id=$1
               ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC LIMIT 50""",
            tenant_id,
        )
        title_prefix = "全部"

    if not rows:
        hint = "（试试对项目说「调出该项目发票」）" if project_filter else ""
        return f"暂无{title_prefix}发票记录。{hint}"

    lines = [f"{title_prefix}发票记录（共{len(rows)}张）:"]
    total_amount = 0
    for r in rows:
        inv_no = r["invoice_no"] or "未编号"
        amt = float(r["total_amount"] or r["amount"] or 0)
        total_amount += amt
        line = f"  #{r['id']} {inv_no} ¥{amt:,.0f}"
        if r.get("project_name"):
            line += f" 项目:{r['project_name']}"
        if r.get("title"):
            line += f" {r['title'][:40]}"
        status = r.get("status", "draft") or "draft"
        payment = r.get("payment_status", "unpaid") or "unpaid"
        line += f" ({status}/{payment})"
        # 有附件标记
        file_ids = r.get("file_ids")
        if file_ids and isinstance(file_ids, (list, str)) and len(str(file_ids)) > 5:
            line += " 📎"
        lines.append(line)
    lines.append(f"  合计金额: ¥{total_amount:,.0f}")
    return "\n".join(lines)


async def _query_payments(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询收款/回款记录（含备用金申请）"""
    rows = await conn.fetch(
        """SELECT bf.type, bf.category, bf.amount, bf.applicant_name, bf.status, bf.reason,
                  bp.name as project, bf.created_at
           FROM biz_finance bf
           LEFT JOIN biz_projects bp ON bp.id = bf.project_id
           WHERE bf.tenant_id=$1 AND bf.type IN ('income','fund_application')
           ORDER BY bf.created_at DESC LIMIT 20""",
        tenant_id,
    )
    if not rows:
        # 回退：也检查 expense 中可能误标记的回款
        rows = await conn.fetch(
            """SELECT bf.type, bf.category, bf.amount, bf.applicant_name, bf.status, bf.reason,
                      bp.name as project, bf.created_at
               FROM biz_finance bf
               LEFT JOIN biz_projects bp ON bp.id = bf.project_id
               WHERE bf.tenant_id=$1 AND bf.type='expense'
               AND (bf.reason ILIKE '%回款%' OR bf.reason ILIKE '%收款%' OR bf.reason ILIKE '%到账%'
                    OR bf.reason ILIKE '%甲方付款%' OR bf.reason ILIKE '%进账%')
               ORDER BY bf.created_at DESC LIMIT 20""",
            tenant_id,
        )
    if not rows:
        return "暂无收款/回款记录。可对我说「收到XX项目回款X元」来记录。"

    company_receipts = [r for r in rows if r["type"] == "income"]
    worker_funds = [r for r in rows if r["type"] == "fund_application"]
    lines = []
    if company_receipts:
        lines.append("【公司收款】:")
        for r in company_receipts:
            lines.append(f"  ¥{r['amount']:,.0f} {r['applicant_name']} ({r['project'] or '未关联项目'}) - {(r['reason'] or '')[:50]} {str(r['created_at'])[:10]}")
    if worker_funds:
        lines.append("【工人请款】:")
        for r in worker_funds:
            lines.append(f"  ¥{r['amount']:,.0f} {r['applicant_name']} ({r['project'] or '未关联项目'}) - {(r['reason'] or '')[:50]} {str(r['created_at'])[:10]} {'[待审批]' if r['status'] == 'pending' else ''}")
    if not lines:
        return "暂无收款/回款记录。"
    total_amount = sum(float(r["amount"] or 0) for r in rows)
    lines.append(f"  合计{len(rows)}笔, 总金额¥{total_amount:,.0f}")
    return "\n".join(lines)


async def _query_not_implemented(conn, message: str, tenant_id: str, **kwargs) -> str:
    """通用未实现功能提示"""
    return "当前版本暂无此功能模块。如需使用，请联系管理员添加。"


async def _query_dashboard(conn, message: str, tenant_id: str, **kwargs) -> str:
    """综合汇报（PM限本项目范围）"""
    user = kwargs.get("user")
    role = (user or {}).get("tenant_role") or "member"

    parts = []
    parts.append(await _query_projects(conn, message, tenant_id, **kwargs))

    # PM: 限本项目
    if role == "project_manager":
        pm_project_id = _get_user_project_id(user)
        if pm_project_id:
            att_today = await conn.fetchval(
                "SELECT COUNT(DISTINCT user_id) FROM biz_attendance WHERE tenant_id=$1 AND project_id=$2 AND type='check_in' AND check_time::date = CURRENT_DATE",
                tenant_id, pm_project_id,
            )
            parts.append(f"\n本项目今日签到: {att_today}人")
            return "\n".join(parts)

    att_today = await conn.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM biz_attendance WHERE tenant_id=$1 AND type='check_in' AND check_time::date = CURRENT_DATE",
        tenant_id,
    )
    parts.append(f"\n今日签到人数: {att_today}")
    alert_count = await conn.fetchval(
        "SELECT COUNT(*) FROM ai_alerts WHERE tenant_id=$1 AND status='active'",
        tenant_id,
    )
    parts.append(f"活跃预警: {alert_count}条")
    pending = await conn.fetchval(
        "SELECT COUNT(*) FROM ai_approvals WHERE tenant_id=$1 AND result='pending_review'",
        tenant_id,
    )
    parts.append(f"待确认审批: {pending}条")
    return "\n".join(parts)


async def _query_wages(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询工资概览（worker仅自己，展示完整的打卡/请款/支取/余额）"""
    user = kwargs.get("user")
    role = (user or {}).get("tenant_role") or "member"

    # worker: 完整财务画像
    if role == "worker":
        username = (user or {}).get("code", "").replace("u_", "")
        if not username:
            return "无法识别您的身份。"
        tu = await conn.fetchrow(
            "SELECT name, ext_data FROM tenant_users WHERE tenant_id=$1 AND user_id=$2",
            tenant_id, username,
        )
        if not tu:
            return "您不在当前团队中。"
        ext = json.loads(tu["ext_data"]) if isinstance(tu["ext_data"], str) else (tu["ext_data"] or {})
        daily_wage = float(ext.get("daily_wage", 0))
        worker_type = ext.get("worker_type", "")

        from datetime import date as _date
        today = _date.today()
        year, month = today.year, today.month
        start_date = _date(year, month, 1)
        if month == 12:
            end_date = _date(year + 1, 1, 1)
        else:
            end_date = _date(year, month + 1, 1)

        # 当月打卡天数
        days_this_month = await conn.fetchval(
            """SELECT COUNT(DISTINCT check_time::date)
               FROM biz_attendance WHERE tenant_id=$1 AND user_id=$2
               AND type='check_in' AND status='normal'
               AND check_time >= $3::date AND check_time < $4::date""",
            tenant_id, username, start_date, end_date,
        )
        # 总打卡天数
        total_days = await conn.fetchval(
            """SELECT COUNT(DISTINCT check_time::date)
               FROM biz_attendance WHERE tenant_id=$1 AND user_id=$2
               AND type='check_in' AND status='normal'""",
            tenant_id, username,
        )

        wage_this_month = days_this_month * daily_wage
        wage_total = total_days * daily_wage

        # 请款/支取记录
        finance_rows = await conn.fetch(
            """SELECT type, category, amount, status, reason, created_at
               FROM biz_finance WHERE tenant_id=$1 AND applicant_name=$2
               ORDER BY created_at DESC LIMIT 30""",
            tenant_id, tu["name"],
        )
        received = sum(float(r["amount"]) for r in finance_rows if r["status"] == "approved")
        pending = sum(float(r["amount"]) for r in finance_rows if r["status"] == "pending")
        total_requested = sum(float(r["amount"]) for r in finance_rows)

        lines = [
            f"{tu['name']}（{worker_type}）工资与资金明细",
            f"日薪：{daily_wage:.0f}元/天",
            f"当月出勤：{days_this_month}天",
            f"当月应得：{wage_this_month:.0f}元",
            f"累计出勤：{total_days}天",
            f"累计应得：{wage_total:.0f}元",
        ]
        if total_requested > 0:
            lines.append("资金请款/支取记录：")
            for fr in finance_rows[:15]:
                type_cn = {"fund_application":"备用金","expense":"费用","wage":"工资支取","income":"收入"}.get(fr["type"], fr["type"])
                status_cn = {"pending":"待审批","approved":"已发放","rejected":"已拒绝"}.get(fr["status"], fr["status"])
                lines.append(f"  {str(fr['created_at'])[:10]} {type_cn} ¥{fr['amount']:.0f} {status_cn} {fr['reason'][:30]}")
            lines.append(f"已发放合计：¥{received:.0f}")
            pending_balance = wage_total - received
            if pending > 0:
                lines.append(f"待审批合计：¥{pending:.0f}")
            lines.append(f"余额（应得-已发放）：¥{pending_balance:.0f}")
        else:
            lines.append("暂无请款记录。")

        return "\n".join(lines)

    # PM: 仅查本项目工资
    if role == "project_manager":
        pm_project_id = _get_user_project_id(user)
        if pm_project_id:
            # get_wage_summary 查全部，这里用项目成员过滤
            from .wage_calculator import calculate_monthly_wages
            wages = await calculate_monthly_wages(tenant_id)
            # 过滤本项目成员
            proj_members = await conn.fetch(
                "SELECT user_id FROM tenant_users WHERE tenant_id=$1 AND ext_data::text LIKE $2",
                tenant_id, f'%"project_id": {pm_project_id}%',
            )
            proj_user_ids = {r["user_id"] for r in proj_members}
            # 也尝试 JSON 整数格式匹配
            proj_members2 = await conn.fetch(
                "SELECT user_id FROM tenant_users WHERE tenant_id=$1 AND ext_data::text LIKE $2",
                tenant_id, f'%"project_id":{pm_project_id}%',
            )
            proj_user_ids.update(r["user_id"] for r in proj_members2)
            wages = [w for w in wages if w["user_id"] in proj_user_ids]
            if not wages:
                return "本项目暂无工人工资数据。"
            from datetime import date
            today = date.today()
            lines = [f"本项目{today.year}年{today.month}月工资："]
            total_all = 0
            for w in wages:
                line = f"  {w['name']}（{w['worker_type']}）：有效{w['valid_days']}天 x {w['daily_wage']:.0f}元/天 = {w['total_wage']:.0f}元"
                lines.append(line)
                total_all += w["total_wage"]
            lines.append(f"  合计：{total_all:,.0f}元")
            return "\n".join(lines)

    # admin/owner: 原有逻辑
    from .wage_calculator import get_wage_summary
    return await get_wage_summary(tenant_id)


# ============================================================
# 配方查询 (recipes)
# ============================================================

# 材料→配方反向索引关键词
_RECIPE_MATERIAL_KEYWORDS = {
    "水泥": "水泥", "白水泥": "白水泥", "普硅": "水泥",
    "石英砂": "石英砂", "石英粉": "石英粉", "硅砂": "石英砂",
    "树脂": "树脂", "环氧树脂": "环氧树脂", "聚氨酯": "聚氨酯",
    "固化剂": "固化剂", "硬化剂": "固化剂",
    "颜料": "颜料", "色浆": "颜料", "色粉": "颜料", "钛白": "钛白粉",
    "减水剂": "减水剂", "增塑剂": "减水剂",
    "骨料": "骨料", "石子": "骨料", "彩砂": "骨料",
    "乳液": "乳液", "丙烯酸": "乳液", "苯丙": "乳液",
}


async def _query_recipes(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询配方：详情 / 按材料反向查 / 目录"""
    # ── 模式1：提取配方名 → 详情 ──
    recipe_name = None
    
    # 1a: "配方叫XX" / "配方: XX" / "配方XX" (XX不包含"配/怎/做"等)
    name_m = re.search(r'(?:配方|工艺)(?:叫|[：:\s]+)([\u4e00-\u9fffA-Za-z0-9._-]{2,30})', message)
    if not name_m:
        # 1a backup: "配方XX" where XX is clearly not a query word
        name_m = re.search(r'(?:配方|工艺)\s*([\u4e00-\u9fffA-Za-z0-9._-]{2,30})(?=\s|$|[，。、]|怎么|如何)', message)
    if name_m:
        raw = name_m.group(1).strip()
        if raw not in ('怎么配', '怎么做', '如何做', '怎么', '如何', '配方', '配比', '工艺'):
            recipe_name = raw
    
    # 1b: "XX配方怎么配" / "K900怎么配" / "磨石配比"
    if not recipe_name:
        name_m = re.search(
            r'([\u4e00-\u9fffA-Za-z0-9._-]{2,20})'
            r'\s*(?:配方|配比|工艺|怎么配|怎么做|成分|如何做)',
            message
        )
        if name_m:
            raw = name_m.group(1).strip()
            # Strip suffix keywords accidentally captured
            raw = re.sub(r'\s*(?:配方|配比|工艺)$', '', raw)
            recipe_name = raw

    if recipe_name:
        row = await conn.fetchrow("""
            SELECT id, name, description, ingredients, steps, category, created_by, created_at
            FROM recipes
            WHERE tenant_id=$1 AND name ILIKE $2 AND status='active'
            ORDER BY created_at DESC LIMIT 1
        """, tenant_id, f'%{recipe_name}%')
        if row:
            lines = [f"配方详情：{row['name']}"]
            if row['category']:
                lines[0] += f"（{row['category']}）"
            if row['description']:
                lines.append(f"  说明：{row['description'][:200]}")
            ingredients = json.loads(row['ingredients']) if isinstance(row['ingredients'], str) else (row['ingredients'] or [])
            if ingredients:
                lines.append("  原料：")
                for ing in ingredients:
                    name = ing.get('name') or ing.get('material', '')
                    qty = ing.get('quantity', '')
                    ratio = ing.get('ratio', '')
                    part = name
                    if qty:
                        part += f" {qty}"
                    if ratio:
                        part += f"（{ratio}）"
                    lines.append(f"    - {part}")
            steps = json.loads(row['steps']) if isinstance(row['steps'], str) else (row['steps'] or [])
            if steps:
                lines.append("  步骤：")
                for s in steps:
                    lines.append(f"    {s.get('step', '')}. {s.get('content', '')}")
            lines.append(f"  创建者：{row['created_by'] or '未知'}，{str(row['created_at'])[:10]}")
            return "\n".join(lines)
        # 未精确匹配 → 尝试退避到材料反查或目录
        recipe_name = None  # fall through

    # ── 模式2：按材料反向查 ──
    material_filter = None
    for kw, label in sorted(_RECIPE_MATERIAL_KEYWORDS.items(), key=lambda x: -len(x[0])):
        if kw in message:
            material_filter = label
            break

    if material_filter:
        all_rows = await conn.fetch(
            "SELECT id, name, description, ingredients, category FROM recipes WHERE tenant_id=$1 AND status='active' ORDER BY category, name",
            tenant_id,
        )
        matched = []
        for r in all_rows:
            ings = json.loads(r['ingredients']) if isinstance(r['ingredients'], str) else (r['ingredients'] or [])
            ings_text = json.dumps(ings, ensure_ascii=False)
            if material_filter in ings_text:
                matched.append(r)
        if matched:
            lines = [f"含{material_filter}的配方（共{len(matched)}个）："]
            for m in matched:
                lines.append(f"  - {m['name']}" + (f"（{m['category']}）" if m.get('category') else ""))
            return "\n".join(lines)
        return f"现有配方中未找到含{material_filter}的配方。可以对我说「录个配方」来添加。"

    # ── 模式3：配方目录 ──
    rows = await conn.fetch(
        "SELECT name, description, category, created_at FROM recipes WHERE tenant_id=$1 AND status='active' ORDER BY category, name",
        tenant_id,
    )
    if not rows:
        return "暂无配方数据。可以对我说「录个配方叫XX，分类面层，原料A:B=1:2」来录入第一个配方。"

    groups: dict[str, list] = {}
    for r in rows:
        cat = r['category'] or '未分类'
        groups.setdefault(cat, []).append(r)

    lines = [f"配方清单（共{len(rows)}个）："]
    for cat in sorted(groups.keys()):
        lines.append(f"  【{cat}】")
        for r in groups[cat]:
            desc = f" — {r['description'][:40]}" if r['description'] else ""
            lines.append(f"    - {r['name']}{desc}")
    return "\n".join(lines)


async def _query_samples(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询样板记录：展示全部信息（图片、配方、项目、录入人、地址、备注等）"""
    from services.sample_service import fuzzy_search
    results = await fuzzy_search(tenant_id, message)
    logger.info(f"样板查询: tenant={tenant_id}, msg='{message[:50]}', results={len(results)}")
    
    if not results:
        return "没找到匹配的样板记录。你可以说「调出3号样板」或「水磨石面层的样板」。"
    
    # 批量解析录入人姓名
    creator_codes = list(set(r.get('created_by','') for r in results if r.get('created_by')))
    creator_map = {}
    if creator_codes:
        # 兼容 u_ 前缀：同时查原始值和去前缀值
        lookup_ids = list(creator_codes)
        for cc in creator_codes:
            if cc.startswith('u_'):
                lookup_ids.append(cc[2:])
        user_rows = await conn.fetch(
            "SELECT user_id, name FROM tenant_users WHERE tenant_id=$1 AND user_id = ANY($2)",
            tenant_id, lookup_ids,
        )
        for ur in user_rows:
            creator_map[ur['user_id']] = ur['name']
            # 也映射 u_ 前缀版本
            creator_map[f'u_{ur["user_id"]}'] = ur['name']
    
    status_cn = {"drafted":"草稿","completed":"已完成","sent_to_factory":"已发工厂",
                 "in_production":"生产中","produced":"已生产"}
    phase_cn = {"proofing":"打样阶段","confirming":"确认中","confirmed":"已确认"}
    lines = ["[Reply in Chinese. 以下是样板查询结果，请在回复中使用 ![](图片URL) 这种markdown格式直接展示图片。]"]
    lines.append(f"找到 {len(results)} 条样板记录：")
    
    any_missing = False  # 是否有缺失字段
    
    for r in results[:15]:
        rid = r['id']
        ts = r['created_at'][:16] if r.get('created_at') else ''
        updated = r.get('updated_at','')[:16] if r.get('updated_at') else ''
        
        # 录入人
        creator_code = r.get('created_by','')
        creator_display = creator_map.get(creator_code, creator_code) if creator_code else ''
        creator_line = f"\n    录入人：{creator_display} ({ts})" if creator_display else f"\n    录入时间：{ts}"
        
        # 基础信息
        parts = []
        if r.get('customer_name'):
            parts.append(f"客户: {r['customer_name']}")
        if r.get('city'):
            parts.append(f"城市: {r['city']}")
        if r.get('shipping_address'):
            parts.append(f"收货地址: {r['shipping_address']}")
        if r.get('specification'):
            parts.append(f"规格: {r['specification']}")
        info_str = " | ".join(parts) if parts else ""
        
        # 配方
        recipe_name = r.get('recipe_name','')
        formula = r.get('formula',{})
        formula_str = ""
        if recipe_name:
            formula_str = f"\n    配方：{recipe_name}"
        if formula and isinstance(formula, dict) and len(formula) > 0:
            items = [f"{k}{v.get('amount','')}{v.get('unit','')}" for k,v in list(formula.items())[:10]]
            formula_str += f"\n    配比：{'、'.join(items)}"
        
        # 项目
        proj_name = r.get('project_name','')
        proj_str = f"\n    关联项目：{proj_name}" if proj_name else ""
        if not proj_name:
            any_missing = True
        
        # 备注
        notes_str = ""
        notes = r.get('notes','')
        if notes and notes.strip():
            display_notes = notes[:200] + ('...' if len(notes) > 200 else '')
            notes_str = f"\n    备注：{display_notes}"
        
        # 发工厂信息
        factory_str = ""
        factory_at = r.get('factory_sent_at')
        if factory_at:
            factory_str = f"\n    发工厂时间：{str(factory_at)[:16]}"
        factory_notes = r.get('factory_notes','')
        if factory_notes and factory_notes.strip():
            factory_str += f"\n    工厂备注：{factory_notes[:200]}"
        
        # 阶段
        phase_val = r.get('phase','')
        phase_str = f"\n    阶段：{phase_cn.get(phase_val, phase_val)}" if phase_val else ""
        if not phase_val:
            any_missing = True
        
        # 签约
        signed_val = r.get('is_signed')
        signed_str = ""
        if signed_val is True:
            signed_str = "\n    签约状态：已签约"
        elif signed_val is False:
            signed_str = "\n    签约状态：未签约"
        else:
            any_missing = True
        
        # 状态
        status = f" [{status_cn.get(r.get('status',''), r.get('status', ''))}]" if r.get('status') else ''
        
        # 有更新则标注
        update_hint = ""
        if updated and updated != ts:
            update_hint = f" (更新:{updated})"
        
        # ── 构造图片链接（全部图片） ──
        img_urls = []
        file_ids = r.get('file_ids', [])
        # file_ids 可能是 JSON 字符串 "[\"f_xxx\"]"，需解析
        if isinstance(file_ids, str) and file_ids.strip():
            try:
                file_ids = json.loads(file_ids)
            except (json.JSONDecodeError, TypeError):
                file_ids = []
        if file_ids and isinstance(file_ids, list) and len(file_ids) > 0:
            try:
                img_urls = await _get_cdn_urls_for_files(conn, file_ids)
            except Exception:
                logger.warning("获取样板图片CDN URL失败", exc_info=True)
                pass
        if not img_urls and r.get('image_url'):
            raw_url = r['image_url']
            # image_url 可能为本地路径，转 CDN
            if raw_url.startswith('uploads/'):
                try:
                    from services.oss_service import get_cdn_url
                    raw_url = get_cdn_url(raw_url)
                except Exception:
                    logger.warning("CDN URL转换失败", exc_info=True)
                    pass
            img_urls = [raw_url]
        # 最后兜底：image_file_id
        if not img_urls and r.get('image_file_id'):
            try:
                single_urls = await _get_cdn_urls_for_files(conn, [r['image_file_id']])
                if single_urls:
                    img_urls = single_urls
            except Exception:
                logger.warning("获取单张图片CDN URL失败", exc_info=True)
                pass
        
        img_line = ""
        if img_urls:
            img_line = f"\n    样板照片({len(img_urls)}张)："
            for u in img_urls:
                img_line += f"\n    ![]({u})"
        
        lines.append(f"  #{rid}{status}{update_hint}\n    基本：{info_str}{formula_str}{proj_str}{phase_str}{signed_str}{creator_line}{notes_str}{factory_str}{img_line}")
    
    # 末尾追加缺失提示
    if any_missing:
        lines.append("\n📋 以上样板部分信息待补齐。你可以告诉我：")
        lines.append("  · 阶段状态（例如「3号样板已确认」「这个样板还在确认阶段」）")
        lines.append("  · 签约状态（例如「3号样板已签约」「这个样板还没签」）")
        lines.append("  · 关联项目（例如「把3号样板绑到永颐项目」）")
    
    return "\n".join(lines)


async def _get_cdn_urls_for_files(conn, file_ids: list) -> list[str]:
    """根据 file_id 列表获取 CDN 图片 URL"""
    try:
        from services.oss_service import get_cdn_url
        rows = await conn.fetch(
            "SELECT file_id, stored_path FROM message_files WHERE file_id = ANY($1)",
            file_ids,
        )
        urls = []
        for r in rows:
            sp = r['stored_path']
            if sp.startswith('uploads/'):
                urls.append(get_cdn_url(sp))
            elif sp.startswith('http'):
                urls.append(sp)
        return urls
    except Exception:
        logger.warning("获取CDN URL失败", exc_info=True)
        return []


async def _query_team_members(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询团队成员信息（PM仅本项目成员），支持按角色筛选"""
    user = kwargs.get("user")
    role = (user or {}).get("tenant_role") or "member"

    rows = await conn.fetch(
        "SELECT user_id, name, role, ext_data FROM tenant_users WHERE tenant_id=$1 ORDER BY created_at",
        tenant_id,
    )
    if not rows:
        return "当前团队暂无成员"

    # 检测是否在按角色查询（如"查项目经理""有哪些技术员"）
    role_keywords = {
        "项目经理": "project_manager",
        "管理员": "admin", "admin": "admin",
        "老板": "owner", "负责人": "owner",
    }
    _is_role_specific_query = any(kw in message for kw in role_keywords)

    # PM: 过滤仅本项目成员（除非是在按角色查全公司的人）
    if role == "project_manager" and not _is_role_specific_query:
        pm_project_id = _get_user_project_id(user)
        if pm_project_id:
            filtered = []
            for r in rows:
                ext = json.loads(r["ext_data"]) if isinstance(r["ext_data"], str) else (r["ext_data"] or {})
                if ext.get("project_id") == pm_project_id:
                    filtered.append(r)
            rows = filtered
            if not rows:
                return "本项目暂无团队成员。"

    role_names = {
        "owner": "老板", "admin": "管理员", "project_manager": "项目经理",
        "member": "成员",
        "customer": "客户",
    }
    # 角色反向映射：中文角色名 → 英文角色code
    role_keywords = {
        "项目经理": "project_manager",
        "管理员": "admin", "admin": "admin",
        "老板": "owner", "负责人": "owner",
    }
    # 从消息中检测是否指定了角色
    target_role_code = None
    for cn, code in role_keywords.items():
        if cn in message:
            target_role_code = code
            break

    if target_role_code:
        # 按角色筛选（"项目"可能匹配到 project_manager 和 project_overview 双重意图）
        rows = [r for r in rows if r["role"] == target_role_code]
        if not rows:
            role_cn = {v: k for k, v in role_names.items()}.get(target_role_code, target_role_code)
            return f"当前团队没有「{role_cn}」角色的成员。"
        role_cn = role_names.get(target_role_code, target_role_code)
        title = f"「{role_cn}」角色成员（共{len(rows)}人）："
    else:
        title = f"团队成员（共{len(rows)}人）："

    parts = [title]
    for r in rows:
        ext = json.loads(r["ext_data"]) if isinstance(r["ext_data"], str) else (r["ext_data"] or {})
        role_cn = role_names.get(r["role"], r["role"])
        line = f"  {r['name']}（{role_cn}）"
        if r["role"] == "worker" and ext.get("worker_type"):
            line += f" - {ext['worker_type']}"
            if ext.get("daily_wage"):
                line += f"，日薪{ext['daily_wage']}元"
        if ext.get("project_name"):
            line += f"，绑定项目：{ext['project_name']}"
        parts.append(line)
    return "\n".join(parts)


async def _query_wechat_messages(conn, message: str, tenant_id: str, **kwargs) -> str:
    """查询已导入的微信群聊记录与分析结果"""
    # 查询群聊列表
    groups = await conn.fetch(
        "SELECT group_id, name, total_messages, last_sync_time FROM wechat_groups WHERE tenant_id=$1 AND is_active=TRUE ORDER BY total_messages DESC LIMIT 10",
        tenant_id,
    )
    if not groups:
        return "暂未导入微信群聊记录。您可以在微信中导出聊天记录（TXT格式），在侧边栏「数据导入」中上传。"

    lines = [f"已导入微信群聊（共{len(groups)}个）："]
    for g in groups:
        line = f"  • {g['name']}（{g['total_messages']}条消息）"
        if g['last_sync_time']:
            line += f"，最近同步：{str(g['last_sync_time'])[:16]}"
        lines.append(line)

    # 查询分析结果
    analyses = await conn.fetch(
        """SELECT group_id, category, summary, status, created_at
           FROM wechat_analysis WHERE tenant_id=$1 AND status='completed'
           ORDER BY created_at DESC LIMIT 10""",
        tenant_id,
    )
    if analyses:
        lines.append(f"\nAI分析结果（近期{len(analyses)}条）：")
        for a in analyses:
            lines.append(f"  • [{a['category']}] {a['summary'][:80] or '（无摘要）'}")

        # 归类统计
        stats = await conn.fetch(
            """SELECT category, COUNT(*) as cnt FROM wechat_analysis
               WHERE tenant_id=$1 AND status='completed'
               GROUP BY category ORDER BY cnt DESC""",
            tenant_id,
        )
        if stats:
            lines.append("\n消息归类统计：")
            for s in stats:
                lines.append(f"  • {s['category']}: {s['cnt']}条")

    return "\n".join(lines)


async def get_business_context(message: str, tenant_id: str, user: dict | None = None) -> str | None:
    """检测用户消息中的业务意图，查询对应数据，返回注入AI上下文的文本"""
    intents = detect_business_intent(message)
    if not intents:
        return None

    role = (user or {}).get("tenant_role") or (user or {}).get("role") or ""
    allowed = _QUERY_PERMISSIONS.get(role, set())

    async with database.pool.acquire() as conn:
        results = []
        seen_fns = set()
        for intent in intents:
            if "*" not in allowed and intent not in allowed:
                continue
            fn_name = INTENT_PATTERNS.get(intent, {}).get("query_fn")
            if not fn_name or fn_name in seen_fns:
                continue
            seen_fns.add(fn_name)
            fn = _QUERY_FNS.get(fn_name)
            if fn:
                result = await fn(conn, message, tenant_id, user=user)
                if result:
                    results.append(result)
        if not results:
            return None
        return "\n\n".join(results)


# 查询函数注册表
_QUERY_FNS = {
    "_query_projects": _query_projects,
    "_query_project_detail": _query_project_detail,
    "_query_attendance": _query_attendance,
    "_query_quality": _query_quality,
    "_query_finance": _query_finance,
    "_query_processes": _query_processes,
    "_query_approvals": _query_approvals,
    "_query_alerts": _query_alerts,
    "_query_customers": _query_customers,
    "_query_suppliers": _query_suppliers,
    "_query_contracts": _query_contracts,
    "_query_payments": _query_payments,
    "_query_my_expenses": _query_my_expenses,
    "_query_not_implemented": _query_not_implemented,
    "_query_dashboard": _query_dashboard,
    "_query_wages": _query_wages,
    "_query_team_members": _query_team_members,
    "_query_recipes": _query_recipes,
    "_query_samples": _query_samples,
    "_query_invoices": _query_invoices,
    "_query_wechat_messages": _query_wechat_messages,
}
