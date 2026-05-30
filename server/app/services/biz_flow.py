"""
灵境AI业务管家 - 业务流程引擎
定义行业特定的全链条业务阶段（状态机），让灵境知道每个客户/项目
该推进到哪一步，主动提醒老板该干什么。

建筑工程行业链条：获客 → 跟进 → 报价 → 签约 → 施工 → 验收 → 交付 → 维保
"""
from datetime import datetime, timezone
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database


# ============================================================
# 行业业务流程定义
# ============================================================

BUSINESS_FLOWS = {
    "construction": {
        "name": "建筑工程",
        "customer_stages": [
            {"code": "lead", "name": "新线索", "next": "contacted",
             "auto_alert_days": 1, "alert": "新客户{name}还没跟进，建议尽快联系"},
            {"code": "contacted", "name": "已联系", "next": "quoting",
             "auto_alert_days": 3, "alert": "客户{name}已联系{days}天未推进，是否需要报价？"},
            {"code": "quoting", "name": "报价中", "next": "negotiating",
             "auto_alert_days": 5, "alert": "客户{name}报价已发{days}天，建议跟进确认"},
            {"code": "negotiating", "name": "谈判中", "next": "signed",
             "auto_alert_days": 7, "alert": "客户{name}谈判中{days}天，注意推进签约"},
            {"code": "signed", "name": "已签约", "next": None,
             "auto_alert_days": None, "alert": None},
            {"code": "lost", "name": "已流失", "next": None,
             "auto_alert_days": None, "alert": None},
        ],
        "supplier_stages": [
            {"code": "prospect", "name": "潜在", "next": "contacted",
             "auto_alert_days": 3, "alert": "潜在供应商{name}建议尽快联系询价"},
            {"code": "contacted", "name": "已联系", "next": "cooperating",
             "auto_alert_days": 7, "alert": "供应商{name}已联系{days}天未推进合作"},
            {"code": "cooperating", "name": "已合作", "next": "rated",
             "auto_alert_days": 90, "alert": "供应商{name}合作{days}天，建议进行评级"},
            {"code": "rated", "name": "已评级", "next": "long_term",
             "auto_alert_days": 180, "alert": "供应商{name}已评级{days}天，是否续评？"},
            {"code": "long_term", "name": "长期合作", "next": None,
             "auto_alert_days": None, "alert": None},
            {"code": "terminated", "name": "已终止", "next": None,
             "auto_alert_days": None, "alert": None},
        ],
        "project_stages": [
            {"code": "not_started", "name": "未开工", "next": "mobilizing",
             "checklist": ["合同已签", "图纸确认", "材料到位", "人员安排"]},
            {"code": "mobilizing", "name": "进场准备", "next": "in_progress",
             "checklist": ["设备进场", "安全交底", "临设搭建"]},
            {"code": "in_progress", "name": "施工中", "next": "inspecting",
             "checklist": ["基层施工", "面层施工", "养护期管控"]},
            {"code": "inspecting", "name": "验收中", "next": "completed",
             "checklist": ["自检通过", "甲方验收", "整改完成"]},
            {"code": "completed", "name": "已完工", "next": "warranty",
             "checklist": ["竣工资料", "结算提交"]},
            {"code": "warranty", "name": "维保期", "next": "closed",
             "checklist": ["维保到期检查", "尾款回收"]},
            {"code": "closed", "name": "已结案", "next": None,
             "checklist": []},
        ],
    },
    "restaurant": {
        "name": "餐饮",
        "customer_stages": [
            {"code": "lead", "name": "新客户", "next": "regular",
             "auto_alert_days": None, "alert": None},
            {"code": "regular", "name": "常客", "next": "vip",
             "auto_alert_days": None, "alert": None},
            {"code": "vip", "name": "VIP", "next": None,
             "auto_alert_days": None, "alert": None},
            {"code": "lost", "name": "已流失", "next": None,
             "auto_alert_days": 30, "alert": "客户{name}已{days}天未消费，考虑发送优惠券"},
        ],
        "supplier_stages": [
            {"code": "prospect", "name": "潜在", "next": "contacted",
             "auto_alert_days": 7, "alert": "潜在食材商{name}建议联系比价"},
            {"code": "contacted", "name": "已联系", "next": "cooperating",
             "auto_alert_days": 14, "alert": "食材商{name}已联系{days}天"},
            {"code": "cooperating", "name": "已合作", "next": "rated",
             "auto_alert_days": 60, "alert": "合作{days}天，建议对{name}进行供货评估"},
            {"code": "rated", "name": "已评级", "next": "long_term",
             "auto_alert_days": 180, "alert": "供应商{name}距上次评级{days}天"},
            {"code": "long_term", "name": "长期合作", "next": None,
             "auto_alert_days": None, "alert": None},
            {"code": "terminated", "name": "已终止", "next": None,
             "auto_alert_days": None, "alert": None},
        ],
        "project_stages": [],
    },
    "retail": {
        "name": "零售",
        "customer_stages": [
            {"code": "lead", "name": "潜客", "next": "contacted",
             "auto_alert_days": 2, "alert": "潜客{name}还未联系"},
            {"code": "contacted", "name": "已触达", "next": "converted",
             "auto_alert_days": 7, "alert": "客户{name}已触达{days}天，跟进转化"},
            {"code": "converted", "name": "已转化", "next": None,
             "auto_alert_days": None, "alert": None},
            {"code": "lost", "name": "已流失", "next": None,
             "auto_alert_days": None, "alert": None},
        ],
        "supplier_stages": [
            {"code": "prospect", "name": "潜在", "next": "contacted",
             "auto_alert_days": 5, "alert": "潜在供货商{name}建议联系洽谈"},
            {"code": "contacted", "name": "已联系", "next": "cooperating",
             "auto_alert_days": 10, "alert": "供货商{name}已联系{days}天未推进"},
            {"code": "cooperating", "name": "已合作", "next": "rated",
             "auto_alert_days": 90, "alert": "供应商{name}合作{days}天，建议评级"},
            {"code": "rated", "name": "已评级", "next": "long_term",
             "auto_alert_days": 180, "alert": "供应商{name}已评级{days}天"},
            {"code": "long_term", "name": "长期合作", "next": None,
             "auto_alert_days": None, "alert": None},
            {"code": "terminated", "name": "已终止", "next": None,
             "auto_alert_days": None, "alert": None},
        ],
        "project_stages": [],
    },
}


def get_flow(industry: str) -> dict | None:
    return BUSINESS_FLOWS.get(industry)


def get_customer_stages(industry: str) -> list[dict]:
    flow = get_flow(industry)
    return flow["customer_stages"] if flow else []


def get_supplier_stages(industry: str) -> list[dict]:
    flow = get_flow(industry)
    return flow.get("supplier_stages", []) if flow else []


def get_project_stages(industry: str) -> list[dict]:
    flow = get_flow(industry)
    return flow["project_stages"] if flow else []


def get_stage_info(industry: str, stage_type: str, code: str) -> dict | None:
    if stage_type == "customer":
        stages = get_customer_stages(industry)
    elif stage_type == "supplier":
        stages = get_supplier_stages(industry)
    else:
        stages = get_project_stages(industry)
    for s in stages:
        if s["code"] == code:
            return s
    return None


# ============================================================
# 流程推进检测 — 扫描需要推进的客户/项目
# ============================================================

async def scan_stale_customers(tenant_id: str, industry: str) -> list[dict]:
    """扫描所有停滞的客户，生成推进提醒"""
    stages = get_customer_stages(industry)
    stage_map = {s["code"]: s for s in stages}
    alerts = []

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, name, phone, status, updated_at
               FROM biz_customers
               WHERE tenant_id=$1 AND status NOT IN ('signed', 'lost', 'converted', 'closed')
               ORDER BY updated_at ASC""",
            tenant_id,
        )

    now = datetime.now(timezone.utc)
    for r in rows:
        stage = stage_map.get(r["status"])
        if not stage or not stage.get("auto_alert_days"):
            continue
        days_since = (now - r["updated_at"]).days
        if days_since >= stage["auto_alert_days"]:
            alert_text = stage["alert"].format(
                name=r["name"], days=days_since
            )
            alerts.append({
                "type": "customer_stale",
                "customer_id": r["id"],
                "customer_name": r["name"],
                "stage": r["status"],
                "days_stale": days_since,
                "message": alert_text,
                "next_stage": stage.get("next"),
            })

    return alerts


async def scan_stale_suppliers(tenant_id: str, industry: str) -> list[dict]:
    """扫描所有停滞的供应商，生成提醒"""
    stages = get_supplier_stages(industry)
    if not stages:
        return []
    stage_map = {s["code"]: s for s in stages}
    alerts = []

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, name, phone, status, updated_at
               FROM biz_suppliers
               WHERE tenant_id=$1 AND status NOT IN ('long_term', 'terminated')
               ORDER BY updated_at ASC""",
            tenant_id,
        )

    now = datetime.now(timezone.utc)
    for r in rows:
        stage = stage_map.get(r["status"])
        if not stage or not stage.get("auto_alert_days"):
            continue
        days_since = (now - r["updated_at"]).days
        if days_since >= stage["auto_alert_days"]:
            alert_text = stage["alert"].format(
                name=r["name"], days=days_since
            )
            alerts.append({
                "type": "supplier_stale",
                "supplier_id": r["id"],
                "supplier_name": r["name"],
                "stage": r["status"],
                "days_stale": days_since,
                "message": alert_text,
                "next_stage": stage.get("next"),
            })

    return alerts


async def scan_stale_projects(tenant_id: str, industry: str) -> list[dict]:
    """扫描所有停滞的项目"""
    stages = get_project_stages(industry)
    if not stages:
        return []

    alerts = []

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, name, status, progress, updated_at, deadline
               FROM biz_projects
               WHERE tenant_id=$1 AND status NOT IN ('completed', 'closed')
               ORDER BY updated_at ASC""",
            tenant_id,
        )

    now = datetime.now(timezone.utc)
    today = now.date()
    for r in rows:
        # 超期预警
        if r["deadline"] and r["deadline"] < today and r["status"] != "completed":
            alerts.append({
                "type": "project_overdue",
                "project_id": r["id"],
                "project_name": r["name"],
                "deadline": str(r["deadline"]),
                "days_overdue": (today - r["deadline"]).days,
                "message": f"项目{r['name']}已超期{(today - r['deadline']).days}天！",
            })
        # 长期未更新
        days_since = (now - r["updated_at"]).days
        if days_since >= 7:
            alerts.append({
                "type": "project_stale",
                "project_id": r["id"],
                "project_name": r["name"],
                "days_stale": days_since,
                "message": f"项目{r['name']}已{days_since}天未更新进度",
            })

    return alerts


async def get_flow_summary(tenant_id: str, industry: str) -> str | None:
    """生成业务流程汇总文本，可注入到AI上下文"""
    flow = get_flow(industry)
    if not flow:
        return None

    customer_alerts = await scan_stale_customers(tenant_id, industry)
    supplier_alerts = await scan_stale_suppliers(tenant_id, industry)
    project_alerts = await scan_stale_projects(tenant_id, industry)

    # 配方 & 样板检查
    recipe_alerts = await _check_recipe_status(tenant_id)

    if not customer_alerts and not supplier_alerts and not project_alerts and not recipe_alerts:
        return None

    lines = ["[灵境流程引擎提醒]"]
    if customer_alerts:
        lines.append(f"待跟进客户({len(customer_alerts)}个):")
        for a in customer_alerts[:5]:
            lines.append(f"  - {a['message']}")

    if supplier_alerts:
        lines.append(f"待跟进供应商({len(supplier_alerts)}个):")
        for a in supplier_alerts[:5]:
            lines.append(f"  - {a['message']}")

    if project_alerts:
        lines.append(f"项目预警({len(project_alerts)}个):")
        for a in project_alerts[:5]:
            lines.append(f"  - {a['message']}")

    if recipe_alerts:
        for a in recipe_alerts:
            lines.append(f"  - {a}")

    return "\n".join(lines)


async def _check_recipe_status(tenant_id: str) -> list[str]:
    """检查配方 & 样板状态，生成技术员引导"""
    alerts = []
    async with database.pool.acquire() as conn:
        recipe_count = await conn.fetchval(
            "SELECT count(*) FROM recipes WHERE tenant_id=$1 AND status='active'",
            tenant_id,
        )
        template_count = await conn.fetchval(
            "SELECT count(*) FROM template_images WHERE tenant_id=$1",
            tenant_id,
        )

    if recipe_count == 0 and template_count == 0:
        alerts.append("尚未录入任何配方或样板。建议对技术员说「录个配方叫XX，原料是XX」，开始积累核心技术资产。")
    elif recipe_count > 0 and template_count == 0:
        alerts.append(f"已有{recipe_count}个配方，但还没有上传样板图片。有配方的样板照片上传后可以进行效果对比。")
    elif recipe_count > 0 and template_count > 0:
        if recipe_count > template_count:
            alerts.append(f"现有{recipe_count}个配方，但只有{template_count}个样板图片。部分配方可能缺少对应的样板效果图。")

    return alerts
