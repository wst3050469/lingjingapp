"""
灵境 - 自动数据同步引擎 (Auto-fetch)
对标 OpenHuman's Auto-fetch

核心机制：定时轮询企业数据源，检测变更后自动同步到记忆库。

同步源（内部）：
1. todo_items — 新创建的待办自动进入记忆
2. projects — 项目状态变化记录为记忆
3. biz_finance — 大额费用记录进入记忆
4. attendance — 考勤异常提醒

数据流:
  POLL (30min) → detect_changes → normalize → memory_extractor → 记忆库
"""

import asyncio
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from .token_compressor import compress

logger = logging.getLogger("lingjing.auto_fetch")

# ── 配置 ───────────────────────────────────────────────────
_FETCH_INTERVAL_SECONDS = 7200  # 2小时（原30分钟，降低频率以提升记忆质量）
_MAX_MEMORIES_PER_CYCLE = 5     # 每周期最多生成记忆数（原20条，减少数量提升质量）
_RUNNING = False
_TASK: Optional[asyncio.Task] = None
_MIGRATION_CHECKED = False


# ============================================================
# 迁移检查
# ============================================================

async def _check_migration():
    """检查 last_synced_at 列是否存在，给出清晰提示"""
    global _MIGRATION_CHECKED
    if _MIGRATION_CHECKED:
        return True
    try:
        async with database.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name='todo_items' AND column_name='last_synced_at'
            """)
            if not row:
                logger.warning(
                    "Auto-fetch: 数据库迁移未执行！请运行:\n"
                    "  psql -U postgres -d lingjing -f server/migrations/005_auto_fetch.sql\n"
                    "迁移前自动同步功能将跳过。"
                )
                _MIGRATION_CHECKED = True
                return False
            _MIGRATION_CHECKED = True
            return True
    except Exception as e:
        logger.warning(f"Auto-fetch: 迁移检查失败: {e}")
        return False


# ============================================================
# 数据同步核心
# ============================================================

async def _fetch_and_sync():
    """执行一次完整的数据同步周期"""
    if not await _check_migration():
        return
    logger.debug("Auto-fetch: 开始数据同步...")
    total = 0

    try:
        total += await _sync_new_todos()
    except Exception as e:
        logger.warning(f"Auto-fetch: 待办同步异常: {e}")

    try:
        total += await _sync_project_changes()
    except Exception as e:
        logger.warning(f"Auto-fetch: 项目同步异常: {e}")

    try:
        total += await _sync_finance_alerts()
    except Exception as e:
        logger.warning(f"Auto-fetch: 财务同步异常: {e}")

    try:
        total += await _sync_attendance_anomalies()
    except Exception as e:
        logger.warning(f"Auto-fetch: 考勤同步异常: {e}")

    if total > 0:
        logger.info(f"Auto-fetch: 同步完成，生成 {total} 条新记忆")
    else:
        logger.debug("Auto-fetch: 无新变更")


async def _sync_new_todos() -> int:
    """同步新增待办 → 记忆库"""
    count = 0
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT t.id, t.title, t.detail, t.priority, t.type,
                   t.tenant_id, t.user_id, t.created_at,
                   u.nickname as creator_name
            FROM todo_items t
            LEFT JOIN users u ON u.id::text = t.user_id
            WHERE t.created_at > NOW() - interval '2 hours'
              AND (t.last_synced_at IS NULL OR t.last_synced_at < t.created_at)
              AND t.status = 'pending'
            ORDER BY t.created_at DESC
            LIMIT $1
        """, _MAX_MEMORIES_PER_CYCLE)

        for r in rows:
            try:
                pri_label = {80: "高", 50: "中", 20: "低"}.get(r["priority"], "中")
                content = f"新待办: {r['title']} [优先级:{pri_label}]"
                if r.get("detail"):
                    content += f" - {r['detail'][:100]}"
                memory_id = f"autofetch_todo_{r['id']}_{r['created_at'].strftime('%Y%m%d%H%M%S')}"

                await conn.execute("""
                    INSERT INTO memories
                        (memory_id, partner_id, tenant_id, content, type,
                         source, priority, confidence, metadata, hash, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    ON CONFLICT (memory_id) DO NOTHING
                """,
                    memory_id,
                    str(r["user_id"] or ""),
                    r["tenant_id"],
                    content[:500],
                    "todo",
                    "autofetch:todos",
                    50,
                    0.8,
                    json.dumps({
                        "provenance": ["autofetch:todos"],
                        "todo_id": r["id"],
                        "source_table": "todo_items",
                    }, ensure_ascii=False),
                    hashlib.sha256(content.encode()).hexdigest()[:16],
                    datetime.now(timezone.utc),
                )
                await conn.execute(
                    "UPDATE todo_items SET last_synced_at = NOW() WHERE id = $1",
                    r["id"],
                )
                count += 1
            except Exception as e:
                logger.debug(f"Auto-fetch: 待办记忆写入失败 id={r['id']}: {e}")

    return count


async def _sync_project_changes() -> int:
    """同步项目状态变更 → 记忆库"""
    count = 0
    status_labels = {
        "in_progress": "进行中",
        "completed": "已完成",
        "finished": "已竣工",
        "suspended": "已暂停",
        "pending": "待开始",
    }
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT p.id, p.name, p.project_status, p.progress,
                   p.tenant_id, p.manager_id, p.updated_at,
                   u.nickname as manager_name
            FROM projects p
            LEFT JOIN users u ON u.id = p.manager_id
            WHERE p.updated_at > NOW() - interval '2 hours'
              AND p.project_status != 'pending'
              AND (p.last_synced_at IS NULL OR p.last_synced_at < p.updated_at)
            ORDER BY p.updated_at DESC
            LIMIT $1
        """, _MAX_MEMORIES_PER_CYCLE)

        for r in rows:
            try:
                st = status_labels.get(r["project_status"], r["project_status"] or "未知")
                content = f"项目更新: {r['name']} [{st}] 进度{r['progress']:.0f}%"
                memory_id = f"autofetch_proj_{r['id']}_{r['updated_at'].strftime('%Y%m%d%H%M%S')}"

                await conn.execute("""
                    INSERT INTO memories
                        (memory_id, partner_id, tenant_id, content, type,
                         source, priority, confidence, metadata, hash, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    ON CONFLICT (memory_id) DO NOTHING
                """,
                    memory_id,
                    str(r["manager_id"] or ""),
                    r["tenant_id"],
                    content[:500],
                    "project_update",
                    "autofetch:projects",
                    60,
                    0.85,
                    json.dumps({
                        "provenance": ["autofetch:projects"],
                        "project_id": str(r["id"]),
                        "source_table": "projects",
                    }, ensure_ascii=False),
                    hashlib.sha256(content.encode()).hexdigest()[:16],
                    datetime.now(timezone.utc),
                )
                await conn.execute(
                    "UPDATE projects SET last_synced_at = NOW() WHERE id = $1",
                    r["id"],
                )
                count += 1
            except Exception as e:
                logger.debug(f"Auto-fetch: 项目记忆写入失败 id={r['id']}: {e}")

    return count


async def _sync_finance_alerts() -> int:
    """同步财务异常（大额费用）→ 记忆库"""
    count = 0
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT f.id, f.amount, f.category, f.type, f.tenant_id,
                   f.applicant_name, f.created_at
            FROM biz_finance f
            WHERE f.amount > 5000
              AND f.created_at > NOW() - interval '2 hours'
              AND (f.last_synced_at IS NULL OR f.last_synced_at < f.created_at)
            ORDER BY f.amount DESC
            LIMIT $1
        """, _MAX_MEMORIES_PER_CYCLE)

        for r in rows:
            try:
                type_label = r["type"] or "支出"
                content = f"新费用: {type_label} ¥{float(r['amount']):,.0f} ({r['category'] or '其他'})"
                if r.get("applicant_name"):
                    content += f" 申请人:{r['applicant_name']}"
                memory_id = f"autofetch_fin_{r['id']}_{r['created_at'].strftime('%Y%m%d%H%M%S')}"

                await conn.execute("""
                    INSERT INTO memories
                        (memory_id, partner_id, tenant_id, content, type,
                         source, priority, confidence, metadata, hash, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    ON CONFLICT (memory_id) DO NOTHING
                """,
                    memory_id,
                    "",
                    r["tenant_id"],
                    compress(content, strategy="smart", max_tokens=100),
                    "finance_alert",
                    "autofetch:finance",
                    55,
                    0.75,
                    json.dumps({
                        "provenance": ["autofetch:finance"],
                        "finance_id": r["id"],
                        "amount": float(r["amount"]),
                    }, ensure_ascii=False),
                    hashlib.sha256(content.encode()).hexdigest()[:16],
                    datetime.now(timezone.utc),
                )
                await conn.execute(
                    "UPDATE biz_finance SET last_synced_at = NOW() WHERE id = $1",
                    r["id"],
                )
                count += 1
            except Exception as e:
                logger.debug(f"Auto-fetch: 财务记忆写入失败 id={r['id']}: {e}")

    return count


async def _sync_attendance_anomalies() -> int:
    """同步考勤异常（连续缺勤）→ 记忆库"""
    count = 0
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT u.id as user_id, u.nickname, u.tenant_id,
                   a2.check_time as last_checkin,
                   (SELECT p.name FROM projects p
                    JOIN project_members pm ON pm.project_id = p.id
                    WHERE pm.user_id = u.id
                    ORDER BY pm.joined_at DESC LIMIT 1) as project_name
            FROM users u
            LEFT JOIN LATERAL (
                SELECT check_time FROM attendance
                WHERE user_id = u.id AND type = 'check_in'
                ORDER BY check_time DESC LIMIT 1
            ) a2 ON true
            WHERE u.status = 'active'
              AND u.tenant_id IS NOT NULL
              AND (
                  a2.check_time IS NULL
                  OR a2.check_time < NOW() - interval '3 days'
              )
            LIMIT $1
        """, _MAX_MEMORIES_PER_CYCLE)

        for r in rows:
            try:
                last = r["last_checkin"]
                days_missing = (datetime.now(timezone.utc) - last.replace(tzinfo=timezone.utc)).days if last else 99
                pname = r["project_name"] or "未知项目"
                content = f"考勤提醒: {r['nickname']} 已{days_missing}天未打卡（{pname}）"
                memory_id = f"autofetch_att_{r['user_id']}_{datetime.now().strftime('%Y%m%d')}"

                await conn.execute("""
                    INSERT INTO memories
                        (memory_id, partner_id, tenant_id, content, type,
                         source, priority, confidence, metadata, hash, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    ON CONFLICT (memory_id) DO NOTHING
                """,
                    memory_id,
                    str(r["user_id"]),
                    r["tenant_id"],
                    content[:500],
                    "attendance_alert",
                    "autofetch:attendance",
                    45,
                    0.7,
                    json.dumps({
                        "provenance": ["autofetch:attendance"],
                        "days_missing": days_missing,
                    }, ensure_ascii=False),
                    hashlib.sha256(content.encode()).hexdigest()[:16],
                    datetime.now(timezone.utc),
                )
                count += 1
            except Exception as e:
                logger.debug(f"Auto-fetch: 考勤记忆写入失败: {e}")

    return count


# ============================================================
# 调度器
# ============================================================

async def _fetch_loop():
    """自动同步主循环"""
    logger.info("Auto-fetch: 自动同步引擎已启动 (间隔=%ds)", _FETCH_INTERVAL_SECONDS)
    await asyncio.sleep(300)
    while _RUNNING:
        await _fetch_and_sync()
        await asyncio.sleep(_FETCH_INTERVAL_SECONDS)


def start_auto_fetch():
    """启动自动同步引擎"""
    global _RUNNING, _TASK
    if _RUNNING:
        logger.warning("Auto-fetch: 引擎已在运行")
        return
    _RUNNING = True
    _TASK = asyncio.create_task(_fetch_loop())
    logger.info("Auto-fetch: 引擎启动完成")


async def stop_auto_fetch():
    """停止自动同步引擎"""
    global _RUNNING, _TASK
    _RUNNING = False
    if _TASK:
        _TASK.cancel()
        _TASK = None
    logger.info("Auto-fetch: 引擎已停止")
