"""灵境平台 - 系统健康与统计路由"""
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
import embedding
import config

logger = logging.getLogger("lingjing.system")

router = APIRouter(prefix="/api/v1", tags=["system"])


@router.get("/health")
async def health():
    db_ok = False
    partner_count = 0
    memory_count = 0
    version_name = "v1.0"
    user_count = 0
    session_count = 0
    tenant_count = 0
    try:
        async with database.pool.acquire() as conn:
            partner_count = await conn.fetchval("SELECT count(*) FROM ai_partners")
            memory_count = await conn.fetchval("SELECT count(*) FROM memories")
            user_count = await conn.fetchval("SELECT count(*) FROM users WHERE status='active'")
            session_count = await conn.fetchval("SELECT count(*) FROM chat_sessions")
            tenant_count = await conn.fetchval("SELECT count(*) FROM tenants WHERE status='active'")
            # 获取最新发布版本号
            vr = await conn.fetchrow(
                "SELECT version_name FROM app_versions WHERE status='published' ORDER BY version_code DESC LIMIT 1")
            if vr:
                version_name = vr["version_name"]
        db_ok = True
    except Exception as e:
        logger.warning(f"健康检查数据库查询失败: {e}")

    ollama_status = await embedding.check_ollama_health()

    return {
        "status": "ok" if db_ok else "degraded",
        "platform": f"灵境 {version_name}",
        "db": "connected" if db_ok else "error",
        "partners": partner_count,
        "memories": memory_count,
        "users": user_count,
        "sessions": session_count,
        "tenants": tenant_count,
        "ollama": ollama_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/stats")
async def stats():
    async with database.pool.acquire() as conn:
        total_memories = await conn.fetchval("SELECT count(*) FROM memories")
        total_partners = await conn.fetchval("SELECT count(*) FROM ai_partners")
        emb_count = await conn.fetchval("SELECT count(*) FROM memories WHERE embedding IS NOT NULL")

        by_partner = await conn.fetch(
            """SELECT partner_id, count(*) AS cnt
               FROM memories GROUP BY partner_id ORDER BY cnt DESC"""
        )
        by_type = await conn.fetch(
            """SELECT type, count(*) AS cnt
               FROM memories GROUP BY type ORDER BY cnt DESC"""
        )
        by_source = await conn.fetch(
            """SELECT source, count(*) AS cnt
               FROM memories WHERE source != '' GROUP BY source ORDER BY cnt DESC"""
        )

        consensus_count = await conn.fetchval("SELECT count(*) FROM consensus_ledger")

    return {
        "code": 0,
        "total_partners": total_partners,
        "total_memories": total_memories,
        "total_consensus": consensus_count,
        "embedding_coverage": round(emb_count / total_memories, 2) if total_memories > 0 else 0,
        "by_partner": {r["partner_id"]: r["cnt"] for r in by_partner},
        "by_type": {r["type"]: r["cnt"] for r in by_type},
        "by_source": {r["source"]: r["cnt"] for r in by_source},
    }


@router.get("/cost/summary")
async def cost_summary():
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    async with database.pool.acquire() as conn:
        daily_cost = await conn.fetchval(
            "SELECT COALESCE(SUM(cost_yuan), 0) FROM cost_tracking WHERE created_at >= $1",
            today_start,
        )
        monthly_cost = await conn.fetchval(
            "SELECT COALESCE(SUM(cost_yuan), 0) FROM cost_tracking WHERE created_at >= $1",
            month_start,
        )
        by_partner = await conn.fetch(
            """SELECT partner_id, SUM(cost_yuan) AS total_cost, count(*) AS calls
               FROM cost_tracking WHERE created_at >= $1
               GROUP BY partner_id ORDER BY total_cost DESC""",
            month_start,
        )

    alerts = []
    if float(daily_cost) > config.COST_ALERT_DAILY:
        alerts.append({"level": "warning", "msg": f"今日费用 {daily_cost:.2f}元 超过日预警线 {config.COST_ALERT_DAILY}元"})
    if float(monthly_cost) > config.COST_ALERT_MONTHLY_CRITICAL:
        alerts.append({"level": "critical", "msg": f"本月费用 {monthly_cost:.2f}元 超过月度红线 {config.COST_ALERT_MONTHLY_CRITICAL}元"})
    elif float(monthly_cost) > config.COST_ALERT_MONTHLY_WARN:
        alerts.append({"level": "warning", "msg": f"本月费用 {monthly_cost:.2f}元 超过月度预警线 {config.COST_ALERT_MONTHLY_WARN}元"})

    return {
        "code": 0,
        "daily_cost": float(daily_cost),
        "monthly_cost": float(monthly_cost),
        "monthly_budget": config.COST_ALERT_MONTHLY_CRITICAL,
        "by_partner": [
            {"partner_id": r["partner_id"], "cost": float(r["total_cost"]), "calls": r["calls"]}
            for r in by_partner
        ],
        "alerts": alerts,
    }


@router.get("/engines")
async def engine_status():
    """返回所有后台引擎的运行状态"""
    now = datetime.now(timezone.utc)

    # 各引擎状态（通过检查 asyncio.Task 存活来判断）
    from services.subconscious_engine import _main_task, _dream_task
    from services.auto_fetch_service import _TASK as af_task

    def _is_alive(t):
        return t is not None and not t.done() and not t.cancelled()

    return {
        "code": 0,
        "engines": {
            "subconscious_engine": {
                "status": "running" if _is_alive(_main_task) else "stopped",
                "main_loop": "active" if _is_alive(_main_task) else "inactive",
                "dream_scheduler": "active" if _is_alive(_dream_task) else "inactive",
                "tick_interval": "300s",
                "dream_time": "03:00 UTC daily",
            },
            "auto_fetch": {
                "status": "running" if _is_alive(af_task) else "stopped",
                "poll_interval": "1800s",
            },
            "report_scheduler": {"status": "running" if _is_alive(_get_report_task()) else "stopped"},
        },
        "timestamp": now.isoformat(),
    }


def _get_report_task():
    try:
        from services.personal_report_service import _scheduler_task
        return _scheduler_task
    except ImportError:
        return None


@router.get("/servers")
async def server_status():
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM servers ORDER BY server_id")
    data = []
    for r in rows:
        d = dict(r)
        for f in ("services", "hardware"):
            if isinstance(d[f], str):
                d[f] = json.loads(d[f])
        data.append(d)
    return {"code": 0, "data": data}


# ── TTS 文本清理测试（用于排查TTS跳过问题） ──────────────
@router.get("/tts-test")
async def tts_test(text: str = "山东俊达化工有限公司明天送货"):
    """测试TTS文本清理效果：输入文本，返回清理前后的对比"""
    from services.tts_service import _clean_text
    original = text
    cleaned = _clean_text(text)
    changes = []
    if original != cleaned:
        for i in range(min(len(original), 200)):
            if i >= len(cleaned) or original[i] != cleaned[i]:
                ctx_before = original[max(0, i - 8):i + 12]
                ctx_after = cleaned[max(0, i - 8):min(len(cleaned), i + 12)]
                changes.append({"position": i, "before": ctx_before, "after": ctx_after})
                break
    return {
        "original": original,
        "cleaned": cleaned,
        "original_length": len(original),
        "cleaned_length": len(cleaned),
        "changed": original != cleaned,
        "first_difference": changes[0] if changes else None,
    }
