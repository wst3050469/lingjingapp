"""
灵境 - 自动化任务执行引擎
每分钟扫描到期任务 → 查询数据 → 生成报告 → 推送通知
替代原有的 ai_reminder.py 简单扫描，升级为完整的自动化任务系统
"""
import asyncio, logging, re
from datetime import datetime, date, timezone, timedelta
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

logger = logging.getLogger("lingjing.automation")

# ========== 数据查询函数 ==========

async def _query_worker_count(tenant_id: str, config: dict) -> str:
    """查询当天出工人数"""
    today = date.today()
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT p.name AS project_name, COUNT(DISTINCT a.user_id) AS worker_count
            FROM biz_attendance a
            JOIN biz_projects p ON a.project_id = p.id AND p.tenant_id = $2
            WHERE a.check_time::date = $1
            GROUP BY p.name
        """, today, tenant_id)
    if not rows:
        return "今日暂无出工记录"
    lines = ["📊 今日出工统计:"]
    total = 0
    for r in rows:
        cnt = r["worker_count"]
        total += cnt
        lines.append(f"  · {r['project_name'] or '未知项目'}: {cnt}人")
    lines.insert(1, f"  总计: {total}人 | {len(rows)}个项目")
    # 查询总工人数
    async with database.pool.acquire() as conn:
        all_workers = await conn.fetchval(
            "SELECT count(*) FROM tenant_users WHERE tenant_id=$1 AND status='active'", tenant_id
        )
    if all_workers:
        lines.append(f"  总工人数: {all_workers}人 | 出工率: {total/max(all_workers,1)*100:.0f}%")
    return "\n".join(lines)


async def _query_attendance(tenant_id: str, config: dict) -> str:
    """查询当天打卡情况"""
    today = date.today()
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT a.user_id, a.type AS check_type, a.check_time,
                   tu.name AS worker_name
            FROM biz_attendance a
            JOIN tenant_users tu ON tu.user_id::text = a.user_id::text AND tu.tenant_id = $1
            WHERE a.check_time::date = $2
            ORDER BY a.check_time
        """, tenant_id, today)
    if not rows:
        return "今日尚无人打卡签到"
    total = len(rows)
    morning = sum(1 for r in rows if r["check_type"] in ("check_in", "上班"))
    evening = sum(1 for r in rows if r["check_type"] in ("check_out", "下班"))
    late = sum(1 for r in rows if r["check_type"] == "late")
    lines = [f"📋 今日打卡统计 (共{total}次):"]
    lines.append(f"  上班打卡: {morning}次 | 下班打卡: {evening}次")
    if late:
        lines.append(f"  ⚠️ 迟到: {late}人次")
    # 缺卡检查
    async with database.pool.acquire() as conn:
        missing = await conn.fetch("""
            SELECT tu.name FROM tenant_users tu
            WHERE tu.tenant_id = $1 AND tu.status = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM biz_attendance a WHERE a.user_id::text = tu.user_id AND a.check_time::date = $2
            )
        """, tenant_id, today)
    if missing:
        names = ", ".join([m["name"] for m in missing[:10]])
        lines.append(f"  ❌ 缺卡({len(missing)}人): {names}")
    return "\n".join(lines)


async def _query_finance(tenant_id: str, config: dict) -> str:
    """查询待审批财务"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT type, count(*) AS cnt, COALESCE(SUM(amount),0) AS total_amount,
                   MIN(created_at) AS oldest
            FROM biz_finance
            WHERE tenant_id = $1 AND status = 'pending'
            GROUP BY type
        """, tenant_id)
    if not rows:
        return "📊 财务: 暂无待审批事项"
    lines = ["📊 待审批财务汇总:"]
    type_cn = {"expense": "报销", "fund_application": "备用金", "wage": "工资"}
    for r in rows:
        t = type_cn.get(r["type"], r["type"])
        age = ""
        if r["oldest"]:
            h = (datetime.now(timezone.utc) - r["oldest"]).total_seconds() / 3600
            if h > 24: age = f" (最早等待{h:.0f}h)"
        lines.append(f"  · {t}: {r['cnt']}笔, ¥{float(r['total_amount']):,.0f}{age}")
    return "\n".join(lines)


async def _query_quality(tenant_id: str, config: dict) -> str:
    """查询质量问题"""
    lines = ["⚠️ 质量预警 (近7天):"]
    has_data = False
    
    # 1. 质检不合格
    async with database.pool.acquire() as conn:
        bad_inspections = await conn.fetchval("""
            SELECT count(*) FROM biz_quality_inspections
            WHERE tenant_id = $1 AND result IS NOT NULL AND result != 'passed'
            AND created_at > NOW() - INTERVAL '7 days'
        """, tenant_id)
    if bad_inspections:
        lines.append(f"  质检不合格: {bad_inspections}条")
        has_data = True
    
    # 2. 审批退回
    async with database.pool.acquire() as conn:
        rejected = await conn.fetchval("""
            SELECT count(*) FROM approvals WHERE tenant_id = $1 AND status = 'rejected'
            AND created_at > NOW() - INTERVAL '7 days'
        """, tenant_id)
    if rejected:
        lines.append(f"  审批退回: {rejected}条")
        has_data = True
    
    # 3. 最近样板记录
    async with database.pool.acquire() as conn:
        recent_samples = await conn.fetch("""
            SELECT notes, created_at FROM sample_records
            WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC LIMIT 5
        """, tenant_id)
    if recent_samples:
        lines.append(f"  近7天样板: {len(recent_samples)}条")
        has_data = True
    
    if not has_data:
        return "✅ 近7天无质量预警"
    return "\n".join(lines)


async def _query_overdue_tasks(tenant_id: str, config: dict) -> str:
    """查询超期任务"""
    now = date.today()
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT title, assignee_id, due_date, CURRENT_DATE - due_date AS days_overdue
            FROM tasks
            WHERE tenant_id = $1 AND due_date < $2
              AND task_status NOT IN ('completed', 'delayed')
              AND record_status = 'active'
            ORDER BY due_date ASC LIMIT 10
        """, tenant_id, now)
    if not rows:
        return "✅ 当前无超期任务"
    lines = [f"🔴 超期任务 ({len(rows)}个):"]
    for r in rows:
        lines.append(f"  · {r['title']}: 截止{r['due_date']}, 超期{r['days_overdue']}天 ({r['assignee_id'] or '未分配'})")
    return "\n".join(lines)


async def _query_project_summary(tenant_id: str, config: dict) -> str:
    """项目综合汇报"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT name, status AS project_status, updated_at FROM biz_projects
            WHERE tenant_id = $1
            ORDER BY updated_at DESC
        """, tenant_id)
    if not rows:
        return "暂无项目"
    status_cn = {"pending": "待开工", "mobilizing": "筹备中", "in_progress": "施工中",
                 "completed": "已完工", "paused": "已暂停", "delayed": "已延期"}
    lines = ["📋 项目综合汇报:"]
    for r in rows:
        s = status_cn.get(r["project_status"], r["project_status"])
        days = (datetime.now(timezone.utc) - r["updated_at"]).days if r["updated_at"] else 0
        stale = f" ⚠️{days}天未更新" if days > 7 else ""
        lines.append(f"  · [{s}] {r['name']}{stale}")
    return "\n".join(lines)


QUERY_MAP = {
    "worker_count_report": _query_worker_count,
    "attendance_report": _query_attendance,
    "finance_summary": _query_finance,
    "quality_alert": _query_quality,
    "task_overdue_report": _query_overdue_tasks,
    "project_summary": _query_project_summary,
    # 下面几个是纯提醒，不需要查数据
    "progress_reminder": None,
    "schedule_reminder": None,
    "checkin_reminder": None,
    "custom": None,
}

REMINDER_MESSAGES = {
    "progress_reminder": "📋 请及时更新项目进度和施工状态",
    "schedule_reminder": "📅 请安排下周人员排班计划",
    "checkin_reminder": "⏰ 请及时上下班打卡，不要忘记签到",
}

# ========== 执行引擎 ==========

_engine_task: Optional[asyncio.Task] = None
_next_scan_at: Optional[datetime] = None


def get_next_run_time(cron_expr: str, from_time: Optional[datetime] = None) -> datetime:
    """简单 cron 解析：计算下次执行时间"""
    now = from_time or datetime.now()
    parts = cron_expr.strip().split()
    if len(parts) != 5:
        return now + timedelta(hours=1)
    
    minute, hour, day, month, weekday = parts
    
    def _match(value: str, current: int) -> bool:
        if value == '*': return True
        if value.startswith('*/'):
            interval = int(value[2:])
            return current % interval == 0
        return str(current) == value
    
    # 从下一分钟开始扫描
    check = now + timedelta(minutes=1)
    check = check.replace(second=0, microsecond=0)
    
    for _ in range(60 * 24 * 31 * 12):  # 最多扫描1年
        if (_match(month, check.month) and
            _match(day, check.day) and
            _match(weekday, check.isoweekday() % 7) and
            _match(hour, check.hour) and
            _match(minute, check.minute)):
            return check
        check += timedelta(minutes=1)
    
    return now + timedelta(hours=1)


async def _execute_task(task: dict) -> dict:
    """执行单个任务，返回执行结果"""
    task_id = task["id"]
    tenant_id = task["tenant_id"]
    task_type = task["task_type"]
    config = task["query_config"] or {}
    
    t0 = datetime.now()
    
    try:
        # 查询数据
        query_fn = QUERY_MAP.get(task_type)
        if query_fn:
            report = await query_fn(tenant_id, config)
        else:
            report = REMINDER_MESSAGES.get(task_type, f"自动化任务: {task['name']}")
        
        duration_ms = int((datetime.now() - t0).total_seconds() * 1000)
        
        # 推送通知（空报告跳过，减少垃圾通知）
        _EMPTY_PATTERNS = r'暂无|无数据|无记录|没有|为空$|^0'
        if not re.search(_EMPTY_PATTERNS, report):
            try:
                from services.notification_service import notify
                
                # 提醒类任务按 target_roles 推送给对应角色
                target_ids = None
                if task_type in ("progress_reminder", "schedule_reminder", "checkin_reminder", "custom"):
                    target_roles = task.get("target_roles") or ["owner", "admin"]
                    if target_roles:
                        async with database.pool.acquire() as conn:
                            users = await conn.fetch(
                                "SELECT user_id FROM tenant_users WHERE tenant_id=$1 AND role=ANY($2) AND status='active'",
                                tenant_id, target_roles,
                            )
                        target_ids = [u["user_id"] for u in users]
                
                await notify(
                    tenant_id=tenant_id,
                    event_type="automation_task",
                    title=f"🤖 {task['name']}",
                    body=report,
                    target_user_ids=target_ids,
                    ref_type="automation",
                    ref_id=str(task_id),
                    extras={"task_type": task_type},
                    priority=70,
                )
            except Exception as e:
                logger.warning(f"推送失败 task={task_id}: {e}")
        
        # 记录日志
        async with database.pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO automated_task_logs (task_id, tenant_id, status, report_text, duration_ms)
                   VALUES ($1, $2, 'success', $3, $4)""",
                task_id, tenant_id, report, duration_ms,
            )
            # 更新任务
            next_run = get_next_run_time(task["cron_expr"])
            await conn.execute(
                """UPDATE automated_tasks SET last_run_at = NOW(), next_run_at = $2,
                   execution_count = execution_count + 1, updated_at = NOW()
                   WHERE id = $1""",
                task_id, next_run,
            )
        
        logger.info(f"任务执行完成: {task['name']} (id={task_id}, {duration_ms}ms)")
        return {"status": "success", "report": report, "duration_ms": duration_ms}
        
    except Exception as e:
        logger.error(f"任务执行失败: {task['name']} (id={task_id}): {e}")
        try:
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO automated_task_logs (task_id, tenant_id, status, error_message)
                       VALUES ($1, $2, 'failed', $3)""",
                    task_id, tenant_id, str(e)[:500],
                )
        except Exception as log_err:
            logger.warning(f"任务失败日志写入失败: {log_err}")
        return {"status": "failed", "error": str(e)}


async def _scan_and_execute():
    """扫描所有到期任务并执行"""
    try:
        async with database.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, tenant_id, name, cron_expr, task_type, query_config, target_roles
                FROM automated_tasks
                WHERE is_enabled = TRUE
                  AND (next_run_at IS NULL OR next_run_at <= NOW())
                ORDER BY next_run_at ASC
                LIMIT 50
            """)
        
        if not rows:
            return 0
        
        for row in rows:
            await _execute_task(dict(row))
        
        return len(rows)
    except Exception as e:
        logger.error(f"扫描失败: {e}")
        return -1


async def start_automation_engine():
    """启动自动化任务引擎"""
    global _engine_task
    
    async def _loop():
        await asyncio.sleep(30)  # 启动后等30秒
        logger.info("🤖 自动化任务引擎已启动")
        while True:
            try:
                executed = await _scan_and_execute()
                if executed > 0:
                    logger.info(f"本轮执行了 {executed} 个任务")
            except Exception as e:
                logger.error(f"自动化引擎异常: {e}")
            await asyncio.sleep(60)  # 每分钟扫描一次
    
    _engine_task = asyncio.create_task(_loop())
    logger.info("自动化引擎调度器已创建")
    return _engine_task


async def stop_automation_engine():
    """停止自动化任务引擎"""
    global _engine_task
    if _engine_task:
        _engine_task.cancel()
        try:
            await _engine_task
        except asyncio.CancelledError:
            pass
        _engine_task = None
        logger.info("自动化引擎已停止")
