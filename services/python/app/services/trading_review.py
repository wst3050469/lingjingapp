"""
交易复盘分析引擎 — 基于 entity_facts + chat_memories 生成个人用户的交易洞察
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from datetime import datetime, timezone, timedelta

_TRADING_KEYWORDS = [
    "股票", "交易", "炒股", "持仓", "止损", "K线", "仓位",
    "盈亏", "打板", "波段", "短线", "中线", "长线", "MACD",
    "均线", "量价", "盘口", "涨停", "跌停",
]

async def get_trading_users() -> list:
    """返回所有交易用户的 invite_code"""
    async with database.pool.acquire() as conn:
        kw_or = " OR ".join([f"content ILIKE '%' || ${i+1} || '%'" for i in range(5)])
        rows = await conn.fetch(f"""
            SELECT DISTINCT partner_id FROM memories
            WHERE ({kw_or})
              AND partner_id LIKE 'u_%'
              AND partner_id NOT IN (SELECT user_id FROM tenant_users)
            LIMIT 50
        """, *_TRADING_KEYWORDS[:5])
        codes = {r["partner_id"] for r in rows}
        rows2 = await conn.fetch("""
            SELECT DISTINCT source_user FROM entity_facts
            WHERE entity_type IN ('stock','trading_strategy','trading_performance')
              AND tenant_id LIKE 'personal:%'
        """)
        codes |= {r["source_user"] for r in rows2}
        return list(codes)

async def analyze_user(invite_code: str) -> dict:
    """分析单个用户交易状况，返回复盘摘要"""
    async with database.pool.acquire() as conn:
        pt = f"personal:{invite_code}"
        stocks = await conn.fetch("""
            SELECT entity_name, field_value, updated_at FROM entity_facts
            WHERE tenant_id=$1 AND entity_type='stock' AND field_name='cost_price'
              AND superseded_by IS NULL
        """, pt)
        holdings = [{"name": s["entity_name"], "cost": s["field_value"],
                     "updated": s["updated_at"]} for s in stocks]

        strategy = {}
        for r in await conn.fetch("""
            SELECT field_name, field_value FROM entity_facts
            WHERE tenant_id=$1 AND entity_type='trading_strategy'
              AND superseded_by IS NULL
        """, pt):
            strategy[r["field_name"]] = r["field_value"]

        profits = []
        for r in await conn.fetch("""
            SELECT field_value, field_name, created_at FROM entity_facts
            WHERE tenant_id=$1 AND entity_type='trading_performance'
              AND superseded_by IS NULL ORDER BY created_at DESC LIMIT 20
        """, pt):
            profits.append({"type": r["field_name"], "value": r["field_value"],
                           "date": r["created_at"]})

        kw_or2 = " OR ".join([f"content ILIKE '%' || ${i+2} || '%'" for i in range(4)])
        memories = []
        for r in await conn.fetch(f"""
            SELECT type, content, priority, created_at FROM memories
            WHERE partner_id=$1 AND ({kw_or2})
            ORDER BY created_at DESC LIMIT 15
        """, invite_code, *_TRADING_KEYWORDS[:4]):
            memories.append({"type": r["type"], "content": r["content"][:200],
                            "priority": r["priority"], "date": r["created_at"]})

        one_week = datetime.now(timezone.utc) - timedelta(days=7)
        kw_or3 = " OR ".join([f"cm.content ILIKE '%' || ${i+2} || '%'" for i in range(4)])
        msgs = []
        for r in await conn.fetch(f"""
            SELECT cm.role, cm.content, cm.created_at FROM chat_messages cm
            JOIN chat_sessions cs ON cm.session_id = cs.session_id
            WHERE cs.invite_code=$1 AND cm.created_at >= $2 AND ({kw_or3})
            ORDER BY cm.created_at DESC LIMIT 30
        """, invite_code, one_week, *_TRADING_KEYWORDS[:4]):
            msgs.append({"role": r["role"], "content": r["content"][:200],
                        "date": r["created_at"]})

    insights = []
    warnings = []

    if holdings:
        names = ", ".join(h["name"] for h in holdings)
        insights.append(f"持仓：{names}")
    else:
        insights.append("持仓：未记录")

    if strategy.get("timeframe"):
        insights.append(f"周期：{strategy['timeframe']}")
    if strategy.get("stop_loss") or strategy.get("stop_loss_price"):
        sl = strategy.get("stop_loss") or strategy.get("stop_loss_price")
        insights.append(f"止损：{sl}")
    if strategy.get("position") or strategy.get("position_size"):
        p = strategy.get("position") or strategy.get("position_size")
        insights.append(f"仓位：{p}")

    loss_count = sum(1 for p in profits if p["type"] == "loss")
    if loss_count >= 3:
        warnings.append(f"近期记录{loss_count}次亏损，建议暂停复盘后再出手")

    stop_kw = ["止损", "连续止损", "连续亏损", "亏了"]
    stop_ms = [m for m in memories if any(kw in m["content"] for kw in stop_kw)]
    if len(stop_ms) >= 3:
        warnings.append(f"记忆中有{len(stop_ms)}次止损/亏损经历，止损执行率需关注")

    decisions = [m for m in memories if m["type"] in ("decision", "action")]
    if decisions:
        insights.append(f"近期决策：{len(decisions)}条")

    user_msgs = [m for m in msgs if m["role"] == "user"]
    if len(user_msgs) >= 5:
        insights.append(f"本周交易讨论：{len(user_msgs)}次")

    has_data = bool(holdings or profits or decisions)

    review_lines = []
    if insights:
        review_lines = ["  " + i for i in insights]
    if warnings:
        review_lines.append("  ⚠️ " + "；".join(warnings))

    suggestions = []
    if loss_count >= 3:
        suggestions.append("用户近期多笔亏损，倾听>给建议，先帮他梳理而非指导")
    if holdings:
        suggestions.append("用户有持仓，复盘时关注决策质量而非盈亏结果")
    tf = strategy.get("timeframe", "")
    if tf in ("短线", "超短线", "日内"):
        suggestions.append("用户做短线，可提醒关注手续费和交易频率")
    suggestions.append("不主动提复盘，在用户聊到交易时自然引入")

    return {
        "invite_code": invite_code,
        "has_data": has_data,
        "summary": "\n".join(review_lines) if review_lines else "",
        "suggestions": suggestions,
        "holdings": holdings,
        "strategy": strategy,
        "loss_count": loss_count,
        "decisions_count": len(decisions),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

def format_review_context(analysis: dict) -> str:
    """格式化为注入系统提示词的上下文"""
    if not analysis.get("has_data") or not analysis.get("summary"):
        return ""
    parts = [f"\n\n[灵境交易复盘 — {analysis['generated_at'][:10]}]"]
    parts.append(analysis["summary"])
    if analysis.get("suggestions"):
        parts.append("\n对话策略：")
        for s in analysis["suggestions"]:
            parts.append(f"  • {s}")
    return "\n".join(parts)
