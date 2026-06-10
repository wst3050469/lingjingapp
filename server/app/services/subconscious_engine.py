"""
灵境 - 背景思考引擎 (Subconscious Engine)
对标 OpenHuman's Subconscious Loop + Dreaming

核心机制：
1. 常驻循环 (5min tick) — 后台持续处理：
   - 检查待办提醒
   - 检测趋势变化
   - 主动生成洞察
   - 检查异常数据
2. 做梦阶段 (每日03:00) — 离线合并记忆：
   - 收集过去24小时新记忆
   - 按实体(客户/供应商/项目)分组
   - AI浓缩摘要 → 写回记忆库
   - 更新实体关联图谱
3. 主动推送 — 通过通知系统推送给前端

对标 OpenHuman:
   Subconscious Loop → background_tick()
   Dreaming → _dream_consolidation()
   Memory Tree → _entity_summary()
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
import config

logger = logging.getLogger("lingjing.subconscious")

# ── 配置 ───────────────────────────────────────────────────
_MAIN_TICK_SECONDS = 300       # 主循环间隔: 5分钟
_LIGHT_TICK_SECONDS = 60       # 轻量检查间隔: 1分钟
_DREAM_HOUR = 3                # 做梦时间: 凌晨3点
_DREAM_WINDOW_HOURS = 2        # 做梦窗口: 2小时
_DREAM_MAX_SOURCES = 15        # 每次做梦最多处理的记忆源

# 待办检查关键词
_TODO_KEYWORDS = ["跟进", "回访", "联系", "催款", "付款", "确认", "验收"]

# ── 引擎状态 ────────────────────────────────────────────────
_running = False
_main_task: Optional[asyncio.Task] = None
_light_task: Optional[asyncio.Task] = None
_dream_task: Optional[asyncio.Task] = None


# ============================================================
# 主循环: 常驻后台处理
# ============================================================

async def background_tick():
    """主循环 tick：5分钟执行一次的后台处理"""
    try:
        await _check_overdue_todos()
        await _check_anomalies()
        await _check_stale_customers()
        await _check_project_deadlines()
        await _check_suppliers()
        logger.debug("Subconscious: 后台tick完成")
    except Exception as e:
        logger.warning(f"Subconscious: 后台tick异常: {e}")


async def _check_overdue_todos():
    """检查逾期待办，生成主动提醒"""
    try:
        now = datetime.now(timezone.utc)
        async with database.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT t.id, t.title, t.user_id, t.priority, t.tenant_id,
                       u.nickname as assignee_name
                FROM todo_items t
                LEFT JOIN users u ON u.id = t.user_id
                WHERE t.status = 'pending'
                  AND t.created_at < $1 - interval '3 days'
                  AND t.created_at > $1 - interval '14 days'
                ORDER BY t.priority DESC, t.created_at ASC
                LIMIT 10
            """, now)
            if rows:
                for r in rows:
                    logger.info(f"Subconscious: 发现逾期待办 #{r['id']} '{r['title']}' (assignee={r['assignee_name']})")
    except Exception as e:
        logger.debug(f"Subconscious: 待办检查异常: {e}")


async def _check_anomalies():
    """检查异常数据（费用、进度等）"""
    try:
        async with database.pool.acquire() as conn:
            today = datetime.now(timezone.utc).date()
            row = await conn.fetchrow("""
                SELECT tenant_id, COUNT(*) as cnt, SUM(amount) as total
                FROM biz_finance
                WHERE created_at::date >= $1
                  AND type = 'expense'
                GROUP BY tenant_id
                ORDER BY total DESC
                LIMIT 3
            """, today)
            if row and row["total"] and row["total"] > 50000:
                logger.info(f"Subconscious: 今日费用异常偏高: tenant={row['tenant_id']}, ¥{row['total']:,.0f}")
    except Exception as e:
        logger.debug(f"Subconscious: 异常检查: {e}")


async def _check_stale_customers():
    """检查超过7天未跟进的客户"""
    try:
        async with database.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT c.id, c.name, c.phone, c.tenant_id, c.updated_at
                FROM biz_customers c
                WHERE c.status != 'lost'
                  AND c.updated_at < NOW() - interval '7 days'
                  AND c.tenant_id IS NOT NULL
                ORDER BY c.updated_at ASC
                LIMIT 5
            """)
            if rows:
                for r in rows:
                    days = (datetime.now(timezone.utc) - r["updated_at"].replace(tzinfo=timezone.utc)).days
                    logger.debug(f"Subconscious: 客户 '{r['name']}' 已{days}天未跟进")
    except Exception as e:
        logger.debug(f"Subconscious: 客户跟进检查: {e}")


async def _check_project_deadlines():
    """检查项目是否临近截止日期或已逾期"""
    try:
        now = datetime.now(timezone.utc)
        async with database.pool.acquire() as conn:
            # 3天内到期的进行中项目
            rows = await conn.fetch("""
                SELECT p.id, p.name, p.project_status, p.progress,
                       p.deadline, p.tenant_id,
                       u.nickname as manager_name
                FROM projects p
                LEFT JOIN users u ON u.id = p.manager_id
                WHERE p.project_status IN ('in_progress', 'pending')
                  AND p.deadline IS NOT NULL
                  AND p.deadline < $1 + interval '3 days'
                  AND p.deleted_at IS NULL
                ORDER BY p.deadline ASC
                LIMIT 5
            """, now)
            for r in rows:
                deadline = r["deadline"]
                days_left = (deadline - now.date()).days if deadline else 0
                if days_left < 0:
                    logger.warning(f"Subconscious: 项目 '{r['name']}' 已逾期{-days_left}天 (负责人:{r['manager_name']})")
                else:
                    logger.info(f"Subconscious: 项目 '{r['name']}' 还有{days_left}天到期 (进度{r['progress']:.0f}%)")
    except Exception as e:
        logger.debug(f"Subconscious: 项目截止检查: {e}")


async def _check_suppliers():
    """检查未跟进的新供应商"""
    try:
        async with database.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT s.id, s.name, s.contact_person,
                       s.phone, s.tenant_id, s.created_at
                FROM biz_suppliers s
                WHERE s.created_at > NOW() - interval '14 days'
                  AND s.tenant_id IS NOT NULL
                ORDER BY s.created_at DESC
                LIMIT 5
            """)
            for r in rows:
                days = (datetime.now(timezone.utc) - r["created_at"].replace(tzinfo=timezone.utc)).days
                logger.debug(f"Subconscious: 新供应商 '{r['name']}' 已{days}天未跟进 (联系人:{r['contact_person']})")
    except Exception as e:
        logger.debug(f"Subconscious: 供应商检查: {e}")


# ============================================================
# 做梦阶段: 离线记忆合并 (每日03:00)
# ============================================================

async def dream_consolidation():
    """做梦：离线合并当日记忆，生成浓缩摘要

    对标 OpenHuman's Dreaming — 离线合并当日记忆，
    按实体(客户/供应商/项目)分组压缩，写回记忆库。
    """
    logger.info("🛌 Subconscious: 进入做梦阶段...")
    try:
        yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
        async with database.pool.acquire() as conn:
            # 1. 收集过去24小时新记忆
            rows = await conn.fetch("""
                SELECT memory_id, partner_id, tenant_id, content, type,
                       source, priority, created_at
                FROM memories
                WHERE created_at >= $1
                  AND type NOT IN ('system', 'dream_summary')
                ORDER BY priority DESC, created_at DESC
                LIMIT $2
            """, yesterday, _DREAM_MAX_SOURCES * 5)

            if not rows:
                logger.info("Subconscious: 无新记忆，跳过做梦")
                return

            logger.info(f"Subconscious: 收集到 {len(rows)} 条新记忆")

            # 2. 按实体分组（客户/供应商/项目/其他）
            groups: dict[str, list[dict]] = {
                "客户": [], "供应商": [], "项目": [], "其他": []
            }
            for r in rows:
                t = r["type"] or "其他"
                if t in groups:
                    groups[t].append(dict(r))
                else:
                    groups["其他"].append(dict(r))

            # 3. 对每个分组生成浓缩摘要（使用LLM摘要或简单拼接）
            dream_count = 0
            for group_name, mems in groups.items():
                if len(mems) < 2:
                    continue  # 少于2条不合并
                # 拼接内容
                contents = [f"- {m['content'][:200]}" for m in mems]
                summary_text = "\n".join(contents)

                # 提取关键词（取前5条内容的前20字拼接）
                keywords = []
                for m in mems[:3]:
                    kw = m["content"][:20].strip()
                    if kw and kw not in keywords:
                        keywords.append(kw)
                # 如果超过2条，调用AI压缩摘要
                if len(mems) >= 3:
                    summary_text = await _ai_compress_summary(
                        f"关于{group_name}的{len(mems)}条记忆",
                        summary_text
                    ) or summary_text

                # 保存为 dream_summary 类型记忆
                dream_memory = {
                    "memory_id": f"dream_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{group_name}",
                    "partner_id": "",  # 跨用户通用
                    "tenant_id": mems[0]["tenant_id"],
                    "content": f"📋 {group_name}记忆合并摘要 ({len(mems)}条):\n{summary_text}",
                    "type": "dream_summary",
                    "source": "subconscious:dream",
                    "priority": 65,  # 略高于普通记忆
                }

                # 写入数据库
                try:
                    await conn.execute("""
                        INSERT INTO memories
                            (memory_id, partner_id, tenant_id, content, type,
                             source, priority, confidence, created_at, expires_at)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                        ON CONFLICT (memory_id) DO NOTHING
                    """,
                        dream_memory["memory_id"],
                        dream_memory["partner_id"],
                        dream_memory["tenant_id"],
                        dream_memory["content"][:2000],
                        dream_memory["type"],
                        dream_memory["source"],
                        dream_memory["priority"],
                        0.85,  # 高置信度
                        datetime.now(timezone.utc),
                        datetime.now(timezone.utc) + timedelta(days=30),
                    )
                    dream_count += 1
                except Exception as e:
                    logger.debug(f"Subconscious: 做梦记忆写入失败: {e}")

            logger.info(f"🛌 Subconscious: 做梦完成，生成 {dream_count} 条浓缩摘要")
    except Exception as e:
        logger.warning(f"Subconscious: 做梦异常: {e}")


async def _ai_compress_summary(title: str, content: str) -> Optional[str]:
    """调用LLM将多条记忆压缩成摘要

    Args:
        title: 摘要标题
        content: 原始内容（多条记忆拼接）

    Returns:
        压缩后的摘要文本，或None（失败时）
    """
    if not config.DEEPSEEK_API_KEY:
        return None
    try:
        import httpx
        import asyncio
        prompt = f"""将以下{title}压缩为100字以内的浓缩摘要，保留关键事实（人名、公司名、价格、日期）。
不要评价，只做事实性摘录。

原始内容：
{content[:2000]}

浓缩摘要（100字以内）："""
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await asyncio.wait_for(
                client.post(
                    f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": config.DEEPSEEK_MODEL,
                        "messages": [
                            {"role": "system", "content": "你是灵境的记忆压缩助手。"},
                            {"role": "user", "content": prompt},
                        ],
                        "max_tokens": 200,
                        "temperature": 0.3,
                    }),
                timeout=10.0)
            data = resp.json()
            summary = data["choices"][0]["message"]["content"].strip()
            if len(summary) > 10:
                return summary
        return None
    except Exception as e:
        logger.debug(f"Subconscious: AI摘要失败: {e}")
        return None


# ============================================================
# 调度器
# ============================================================

async def _main_loop():
    """主循环调度器"""
    logger.info("Subconscious: 背景思考引擎已启动 (tick=%ds)", _MAIN_TICK_SECONDS)
    while _running:
        await background_tick()
        await asyncio.sleep(_MAIN_TICK_SECONDS)


async def _dream_scheduler():
    """做梦调度器：每日凌晨3点执行"""
    logger.info("Subconscious: 做梦调度器已启动 (每天%02d:00)", _DREAM_HOUR)
    while _running:
        now = datetime.now(timezone.utc)
        # 计算下一个目标时间
        target = now.replace(hour=_DREAM_HOUR, minute=0, second=0, microsecond=0)
        if now >= target:
            target += timedelta(days=1)
        wait_seconds = (target - now).total_seconds()
        logger.debug(f"Subconscious: 下次做梦时间 {target.isoformat()}")
        await asyncio.sleep(wait_seconds)
        if not _running:
            break
        # 做梦窗口内可能多次尝试
        window_end = datetime.now(timezone.utc) + timedelta(hours=_DREAM_WINDOW_HOURS)
        while _running and datetime.now(timezone.utc) < window_end:
            await dream_consolidation()
            await asyncio.sleep(3600)  # 每小时重试一次


def start_subconscious_engine():
    """启动背景思考引擎"""
    global _running, _main_task, _dream_task
    if _running:
        logger.warning("Subconscious: 引擎已在运行")
        return
    _running = True
    _main_task = asyncio.create_task(_main_loop())
    _dream_task = asyncio.create_task(_dream_scheduler())
    logger.info("Subconscious: 引擎启动完成")


async def stop_subconscious_engine():
    """停止背景思考引擎"""
    global _running, _main_task, _dream_task
    _running = False
    if _main_task:
        _main_task.cancel()
        _main_task = None
    if _dream_task:
        _dream_task.cancel()
        _dream_task = None
    logger.info("Subconscious: 引擎已停止")
