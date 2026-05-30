"""
灵境 - 个人成长报告生成服务

每周日凌晨自动为活跃用户生成个人成长报告：
- 交易用户：盈亏复盘、情绪模式、纪律评分
- 企业用户：项目进展、客户变化、待办完成
- 通用：对话频率、关键决策、待跟进事项

报告持久化存储，下次对话时AI可引用。
"""
import asyncio
import logging
import httpx
from datetime import datetime, timezone, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
import config

logger = logging.getLogger("lingjing.personal_report")

_SCAN_INTERVAL_HOURS = 6
_WEEKLY_GENERATE_DAY = 6  # 6 = Sunday (0=Monday)

_TRADING_KEYWORDS = [
    "股票", "交易", "炒股", "持仓", "止损", "K线", "仓位",
    "盈亏", "打板", "波段", "短线", "中线", "长线", "MACD",
    "均线", "量价", "盘口", "涨停", "跌停",
]

async def _get_active_users(week_start: datetime) -> list[dict]:
    """获取本周有对话记录的活跃用户"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT cs.invite_code, cs.tenant_id,
                   COUNT(DISTINCT cs.session_id) as sessions,
                   COUNT(cm.id) as messages,
                   MAX(cm.created_at) as last_msg
            FROM chat_sessions cs
            JOIN chat_messages cm ON cm.session_id = cs.session_id
            WHERE cm.created_at >= $1
            GROUP BY cs.invite_code, cs.tenant_id
            HAVING COUNT(DISTINCT cs.session_id) >= 1
            ORDER BY last_msg DESC
            LIMIT 50
        """, week_start)
    results = []
    for r in rows:
        results.append({
            "invite_code": r["invite_code"],
            "tenant_id": r["tenant_id"],
            "sessions": r["sessions"],
            "messages": r["messages"],
            "last_msg": r["last_msg"],
        })
    return results


async def _is_trading_user(invite_code: str) -> bool:
    """判断是否为交易用户"""
    async with database.pool.acquire() as conn:
        kw_or = " OR ".join([f"content ILIKE '%' || ${i+2} || '%'" for i in range(5)])
        row = await conn.fetchval(f"""
            SELECT 1 FROM memories
            WHERE partner_id=$1 AND ({kw_or})
            LIMIT 1
        """, invite_code, *_TRADING_KEYWORDS[:5])
        return bool(row)


async def _gather_user_context(invite_code: str, tenant_id: str | None, week_start: datetime) -> dict:
    """收集单个用户本周所有上下文数据"""
    ctx = {
        "invite_code": invite_code,
        "tenant_id": tenant_id,
        "is_trading": False,
        "is_enterprise": bool(tenant_id),
        "memories_new": 0,
        "memory_types": {},
        "topics": [],
        "recent_decisions": [],
        "chat_sessions": 0,
        "chat_messages": 0,
        "company_name": "",
    }

    async with database.pool.acquire() as conn:
        mem_rows = await conn.fetch("""
            SELECT type, content, metadata, priority, created_at
            FROM memories
            WHERE partner_id=$1 AND created_at >= $2
            ORDER BY priority DESC, created_at DESC
            LIMIT 30
        """, invite_code, week_start)
        ctx["memories_new"] = len(mem_rows)
        for mr in mem_rows:
            t = mr["type"] or "其他"
            ctx["memory_types"][t] = ctx["memory_types"].get(t, 0) + 1
            if mr["priority"] and mr["priority"] >= 60:
                ctx["topics"].append({
                    "type": t,
                    "content": mr["content"][:200],
                    "priority": mr["priority"],
                })

        dec_rows = await conn.fetch("""
            SELECT content, metadata, created_at
            FROM memories
            WHERE partner_id=$1 AND type='decision' AND created_at >= $2
            ORDER BY created_at DESC LIMIT 5
        """, invite_code, week_start)
        ctx["recent_decisions"] = [
            {"content": d["content"][:200], "ts": d["created_at"].isoformat()}
            for d in dec_rows
        ]

        chat_rows = await conn.fetch("""
            SELECT cs.session_id, COUNT(cm.id) as cnt, MAX(cm.created_at) as last_ts
            FROM chat_sessions cs
            JOIN chat_messages cm ON cm.session_id = cs.session_id
            WHERE cs.invite_code=$1 AND cm.created_at >= $2
            GROUP BY cs.session_id
            ORDER BY last_ts DESC
        """, invite_code, week_start)
        ctx["chat_sessions"] = len(chat_rows)
        ctx["chat_messages"] = sum(c["cnt"] for c in chat_rows)

        if tenant_id:
            row = await conn.fetchval(
                "SELECT company_name FROM tenants WHERE tenant_id=$1", tenant_id)
            if row:
                ctx["company_name"] = row

        ctx["is_trading"] = await _is_trading_user(invite_code)

        if ctx["is_trading"] and tenant_id is None:
            pt = f"personal:{invite_code}"
            stocks = await conn.fetch("""
                SELECT entity_name, field_value, updated_at FROM entity_facts
                WHERE tenant_id=$1 AND entity_type='stock' AND field_name='cost_price'
                  AND superseded_by IS NULL
                ORDER BY updated_at DESC LIMIT 5
            """, pt)
            ctx["holdings"] = [
                {"name": s["entity_name"], "cost": s["field_value"]} for s in stocks
            ]

    return ctx


async def _generate_report(ctx: dict, week_start: datetime) -> str:
    """调用 DeepSeek 生成结构化报告"""
    week_end = week_start + timedelta(days=7)
    user_type = "交易者" if ctx["is_trading"] else ("企业用户" if ctx["is_enterprise"] else "个人用户")
    company = ctx.get("company_name", "")
    company_line = f"，属于 {company}" if company else ""

    topics_text = ""
    if ctx["topics"]:
        topics_text = "\n".join(
            f"  - [{t['type']}] {t['content'][:120]}" for t in ctx["topics"][:10])

    decisions_text = ""
    if ctx["recent_decisions"]:
        decisions_text = "\n".join(f"  - {d['content'][:150]}" for d in ctx["recent_decisions"])

    memories_summary = ", ".join(
        f"{t}({c}条)" for t, c in sorted(ctx["memory_types"].items(), key=lambda x: -x[1])[:5]
    ) or "无"

    prompt = f"""你是灵境——用户信赖的AI数字大脑。请为一位{user_type}用户生成本周个人成长报告。

📅 报告周期：{week_start.strftime('%m/%d')} - {week_end.strftime('%m/%d')}
👤 用户类型：{user_type}{company_line}
📊 本周数据：
  - 对话：{ctx['chat_sessions']}个会话，{ctx['chat_messages']}条消息
  - 新记忆：{ctx['memories_new']}条（{memories_summary}）

{"📌 本周关键话题：" if topics_text else ""}
{topics_text}

{"📝 本周决策记录：" if decisions_text else ""}
{decisions_text}"""

    if ctx["is_trading"] and "holdings" in ctx:
        holds = ctx["holdings"]
        if holds:
            holds_text = "\n".join(f"  - {h['name']} (成本: {h['cost']})" for h in holds)
            prompt += f"""

⚠️ 当前持仓：
{holds_text}

请额外分析：最近一周的持仓变化趋势、可能的情绪模式（贪婪/恐惧/后悔）、交易纪律评分（1-10分并说明理由）"""

    if ctx["is_enterprise"] and ctx["tenant_id"]:
        prompt += """

🏢 企业模式：请在报告中包含业务动态的简要概览，并基于记忆类型分布给出本周业务重点领域。"""

    prompt += """

---
请以灵境的口吻生成报告，要求：
1. 开头用一句温暖的话
2. 语气真诚、有温度，像老朋友在帮你复盘
3. 结构：📊数据概览 → 🔑关键话题 → 📝重要决策 → 🌱下周建议
4. 控制在 400 字以内，精炼有力
5. 结尾给一句鼓励的话
6. 纯文本，不要 markdown 格式"""

    api_key = config.DEEPSEEK_API_KEY
    base_url = config.DEEPSEEK_BASE_URL
    model = config.DEEPSEEK_MODEL

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "你是灵境，一位温暖的AI伙伴。你的报告真诚、有温度、有洞察力。"},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 800,
                    "temperature": 0.7,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return content.strip()
            else:
                logger.error(f"DeepSeek报告生成失败: HTTP {resp.status_code}: {resp.text[:200]}")
                return ""
    except Exception as e:
        logger.error(f"生成报告异常: {e}")
        return ""


async def _store_report(
    invite_code: str, tenant_id: str | None, content: str,
    week_start: datetime, is_trading: bool
) -> bool:
    """保存报告到数据库"""
    if not content:
        return False
    week_end = week_start + timedelta(days=7)
    report_id = f"rprt_{invite_code}_{week_start.strftime('%Y%m%d')}"

    try:
        async with database.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO personal_reports
                    (report_id, partner_id, tenant_id, report_type, content,
                     period_start, period_end, is_trading)
                VALUES ($1, $2, $3, 'weekly', $4, $5, $6, $7)
                ON CONFLICT (report_id) DO UPDATE
                SET content=$4, updated_at=NOW()
            """, report_id, invite_code, tenant_id,
                content, week_start, week_end, is_trading)
        logger.info(f"报告已存储: {report_id}")
        return True
    except Exception as e:
        logger.error(f"存储报告失败 {report_id}: {e}")
        return False


async def generate_weekly_reports(force: bool = False):
    """主函数：为所有活跃用户生成本周报告"""
    now = datetime.now(timezone.utc)
    weekday = now.weekday()

    if not force and weekday != _WEEKLY_GENERATE_DAY:
        return

    if not force and not (1 <= now.hour <= 7):
        return

    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    if not force:
        try:
            async with database.pool.acquire() as conn:
                existing = await conn.fetchval(
                    "SELECT count(*) FROM personal_reports WHERE period_start=$1", week_start)
                if existing and existing > 0:
                    logger.info(f"本周报告已生成({existing}份)，跳过")
                    return
        except Exception:
            logger.warning("检查周报是否已生成失败", exc_info=True)
            pass

    logger.info(f"开始生成周报: 周期={week_start.strftime('%Y-%m-%d')}")

    users = await _get_active_users(week_start)
    if not users:
        logger.info("本周无活跃用户，跳过报告生成")
        return

    success = 0
    for user in users:
        invite_code = user["invite_code"]
        tenant_id = user.get("tenant_id")

        try:
            ctx = await _gather_user_context(invite_code, tenant_id, week_start)
            if ctx["chat_messages"] < 2 and not force:
                continue

            report = await _generate_report(ctx, week_start)
            stored = await _store_report(invite_code, tenant_id, report, week_start, ctx["is_trading"])
            if stored:
                success += 1

            await asyncio.sleep(1.5)

        except Exception as e:
            logger.warning(f"用户 {invite_code} 报告生成失败: {e}")

    logger.info(f"周报生成完成: {success}/{len(users)} 份")


async def retrieve_latest_report(
    invite_code: str | None,
    tenant_id: str | None = None,
) -> dict | None:
    """获取用户最新一期报告（用于注入AI对话上下文）"""
    if not invite_code:
        return None
    try:
        async with database.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT report_id, content, period_start, period_end, created_at, is_trading
                FROM personal_reports
                WHERE partner_id=$1
                ORDER BY period_start DESC LIMIT 1
            """, invite_code)
        if not row:
            return None
        return {
            "report_id": row["report_id"],
            "content": row["content"],
            "period_start": row["period_start"].strftime("%m/%d") if row["period_start"] else "",
            "period_end": row["period_end"].strftime("%m/%d") if row["period_end"] else "",
            "created_at": row["created_at"].isoformat(),
            "is_trading": row["is_trading"],
        }
    except Exception as e:
        logger.warning(f"获取最新报告失败: {e}")
        return None


_scheduler_task: asyncio.Task | None = None


async def _scheduler_loop():
    """每6小时检查一次，仅在周日凌晨生成"""
    while True:
        await asyncio.sleep(_SCAN_INTERVAL_HOURS * 3600)
        try:
            await generate_weekly_reports()
        except Exception as e:
            logger.error(f"周报调度器异常: {e}")


async def start_report_scheduler():
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("个人成长报告调度器已启动（每周日自动生成）")


async def stop_report_scheduler():
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    logger.info("个人成长报告调度器已停止")
