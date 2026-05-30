"""
灵境 - AI 主动提醒引擎

核心理念：灵境不是被动的AI，而是会主动扫描业务状态、
在自己"动脑子"后给用户推送提醒的数字大脑。

触发时机：
  1. 定时扫描：早8点、下午2点各一次
  2. 事件驱动：每次 todo_service.generate_todos() 后联动
  3. 超期升级：pending超过24h的审批/任务自动升级提醒
"""
import asyncio
import json
import logging
from typing import Optional

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

logger = logging.getLogger("lingjing.ai_reminder")

# 提醒频率配置
_SCAN_INTERVAL_HOURS = 6  # 每6小时扫描一次
_URGENT_UPGRADE_HOURS = 24  # 超过24h未处理升级为紧急
_CRITICAL_UPGRADE_HOURS = 48  # 超过48h标记为严重


async def _get_active_tenants() -> list[dict]:
    """获取所有活跃租户"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT tenant_id, company_name, config, plan FROM tenants WHERE status='active'"
        )
    return [
        {"tenant_id": r["tenant_id"], "company_name": r["company_name"],
         "config": json.loads(r["config"]) if isinstance(r["config"], str) else (r["config"] or {}),
         "plan": r["plan"]}
        for r in rows
    ]


async def scan_and_remind(tenant_id: Optional[str] = None):
    """
    核心扫描函数：检查各租户的待处理事项并主动推送提醒

    扫描内容：
      1. 待审批的报销/备用金（按超时时长分级）
      2. 超期未完成的任务
      3. 停滞的客户跟进
      4. 无签到记录的项目
    """
    tenants = (
        [{"tenant_id": t, "company_name": t, "config": {}, "plan": "basic"}
         for t in [tenant_id]]
        if tenant_id
        else await _get_active_tenants()
    )

    total_reminders = 0

    for tenant in tenants:
        tid = tenant["tenant_id"]
        try:
            reminders = await _scan_tenant(tid)
            if reminders:
                await _send_ai_reminders(tid, reminders, tenant.get("company_name", ""))
                total_reminders += len(reminders)
        except Exception as e:
            logger.warning(f"扫描租户 {tid} 失败: {e}")

    logger.info(f"AI主动提醒完成: {len(tenants)}个租户, {total_reminders}条提醒")
    return total_reminders


async def _scan_tenant(tenant_id: str) -> list[dict]:
    """扫描单个租户的待处理事项（含 todo_items 未处理提醒）"""
    reminders = []

    # 0. 先刷新所有待办项
    try:
        from services.todo_service import generate_todos
        await generate_todos(tenant_id, "")
    except Exception as e:
        logger.warning(f"刷新待办失败 tenant={tenant_id}: {e}")

    async with database.pool.acquire() as conn:
        # 1. 待审批财务（报销/备用金/工资）
        pending_rows = await conn.fetch(
            """SELECT id, type, amount, applicant_name, reason, created_at,
                      EXTRACT(EPOCH FROM (NOW() - created_at))/3600 AS hours_pending
               FROM biz_finance
               WHERE tenant_id=$1 AND status='pending'
               ORDER BY created_at ASC""",
            tenant_id,
        )
        for r in pending_rows:
            hours = float(r["hours_pending"])
            urgency = "normal"
            if hours >= _CRITICAL_UPGRADE_HOURS:
                urgency = "critical"
            elif hours >= _URGENT_UPGRADE_HOURS:
                urgency = "urgent"

            type_cn = {"expense": "报销", "fund_application": "备用金", "wage": "工资"}.get(
                r["type"], r["type"]
            )
            reminders.append({
                "type": "pending_finance",
                "finance_id": r["id"],
                "title": f"⚠️ {r['applicant_name']} 的{type_cn}已等待{hours:.0f}小时",
                "body": f"金额: ¥{float(r['amount']):,.0f}，请尽快审批",
                "urgency": urgency,
                "hours_pending": hours,
                "ref_id": str(r["id"]),
            })

        # 2. 超期任务
        overdue_tasks = await conn.fetch(
            """SELECT id, title, assignee_id, due_date, project_id,
                      CURRENT_DATE - due_date AS days_overdue
               FROM tasks
               WHERE tenant_id=$1 AND due_date IS NOT NULL
                 AND due_date < CURRENT_DATE
                 AND task_status NOT IN ('completed', 'delayed')
                 AND record_status='active'
               ORDER BY due_date ASC
               LIMIT 10""",
            tenant_id,
        )
        for t in overdue_tasks:
            reminders.append({
                "type": "task_overdue",
                "task_id": t["id"],
                "title": f"🔴 任务超期: {t['title']}",
                "body": f"截止日期: {t['due_date']}，已超{t['days_overdue']}天",
                "urgency": "urgent",
                "days_overdue": t["days_overdue"],
                "ref_id": str(t["id"]),
            })

        # 3. 无签到项目（今日）
        no_checkin = await conn.fetch(
            """SELECT p.id, p.name
               FROM projects p
               WHERE p.tenant_id=$1
                 AND p.project_status IN ('in_progress', 'pending', 'mobilizing')
                 AND p.deleted_at IS NULL
                 AND NOT EXISTS (
                   SELECT 1 FROM attendance a
                   WHERE a.project_id=p.id AND a.check_time::date = CURRENT_DATE
                 )
               LIMIT 5""",
            tenant_id,
        )
        for p in no_checkin:
            reminders.append({
                "type": "no_checkin",
                "title": f"📌 项目「{p['name']}」今日无人签到",
                "body": "请提醒施工人员打卡",
                "urgency": "normal",
                "ref_id": str(p["id"]),
            })

        # 4. 未处理待办 (扫描 todo_items 表中 pending 超阈值项)
        todo_rows = await conn.fetch("""
            SELECT id, type, title, priority,
                   EXTRACT(EPOCH FROM (NOW() - created_at))/3600 AS hours_pending
            FROM todo_items
            WHERE tenant_id=$1 AND status='pending'
            ORDER BY priority DESC, created_at ASC
            LIMIT 20
        """, tenant_id)
        for td in todo_rows:
            hours = float(td["hours_pending"])
            urgency = "normal"
            if hours >= _CRITICAL_UPGRADE_HOURS:
                urgency = "critical"
            elif hours >= _URGENT_UPGRADE_HOURS:
                urgency = "urgent"
            elif hours < 1:
                # 1小时内的待办不重复提醒（刚生成）
                continue
            type_label = {
                "approval_pending": "审批待办",
                "task_overdue": "超期任务",
                "stale_project": "停滞项目",
                "quality_issue": "质量问题",
                "customer_stale": "客户跟进",
                "supplier_stale": "供应商跟进",
                "my_task": "个人任务",
                "checkin_missing": "缺卡",
                "approval_rejected_my": "申请被驳",
            }.get(td["type"], td["type"])

            reminders.append({
                "type": "todo_pending",
                "todo_id": td["id"],
                "title": f"📋 待办提醒: {td['title'][:60]}",
                "body": f"已等待{hours:.0f}小时，请及时处理 ({type_label})",
                "urgency": urgency,
                "hours_pending": hours,
                "ref_id": str(td["id"]),
            })

    return reminders


async def _send_ai_reminders(tenant_id: str, reminders: list[dict], company_name: str):
    """通过通知服务发送AI提醒"""
    try:
        from services.notification_service import notify

        if len(reminders) > 1:
            # 多条汇总：发一条摘要通知
            urgent_count = sum(1 for r in reminders if r["urgency"] in ("urgent", "critical"))
            summary_body = "、".join([r["title"] for r in reminders[:5]])
            if len(reminders) > 5:
                summary_body += f" 等共{len(reminders)}项"

            await notify(
                tenant_id=tenant_id,
                event_type="ai_reminder",
                title=f"🤖 灵境提醒：{len(reminders)}项待处理" +
                      (f"（{urgent_count}项紧急）" if urgent_count else ""),
                body=summary_body,
                ref_type="ai_reminder",
                ref_id="",
                extras={"reminder_count": len(reminders), "urgent_count": urgent_count},
                priority=80 if urgent_count else 50,
            )
        else:
            # 单条：逐条发送
            for r in reminders:
                await notify(
                    tenant_id=tenant_id,
                    event_type="ai_reminder",
                    title=f"🤖 {r['title']}",
                    body=r["body"],
                    ref_type=r.get("type", "ai_reminder"),
                    ref_id=r.get("ref_id", ""),
                    extras={"urgency": r["urgency"]},
                    priority=80 if r["urgency"] in ("urgent", "critical") else 50,
                )

        # ── 紧急项 SMS 通知 ──
        urgent_reminders = [r for r in reminders if r["urgency"] == "critical"]
        if urgent_reminders:
            try:
                from services.sms_service import send_reminder_sms
                from config import SMS_ENABLED

                if SMS_ENABLED:
                    # 查询租户管理员手机号
                    async with database.pool.acquire() as conn:
                        admin_rows = await conn.fetch(
                            """SELECT u.phone, u.username FROM users u
                               JOIN tenant_users tu ON tu.user_id = u.id
                               WHERE tu.tenant_id=$1 AND tu.role IN ('admin','owner')
                                 AND u.phone IS NOT NULL AND u.phone != ''
                               LIMIT 3""",
                            tenant_id,
                        )

                    for admin in admin_rows:
                        for r in urgent_reminders[:2]:  # 最多发2条紧急短信
                            await send_reminder_sms(
                                phone=admin["phone"],
                                title=r["title"],
                                body=r["body"],
                                tenant_id=tenant_id,
                            )
            except ImportError:
                pass  # sms_service 未安装
            except Exception as e:
                logger.warning(f"紧急SMS通知失败 tenant={tenant_id}: {e}")

    except Exception as e:
        logger.error(f"发送AI提醒失败 tenant={tenant_id}: {e}")


# ========== 定时调度器 ==========

_reminder_task: Optional[asyncio.Task] = None


async def start_reminder_scheduler():
    """启动定时提醒调度器（在应用启动时调用）"""
    global _reminder_task

    async def _loop():
        # 启动后延迟60秒先跑一次（等所有服务就绪）
        await asyncio.sleep(60)
        logger.info("🤖 AI主动提醒引擎已启动")
        while True:
            try:
                await scan_and_remind()
            except Exception as e:
                logger.error(f"AI提醒扫描异常: {e}")
            # 按扫描间隔休眠
            await asyncio.sleep(_SCAN_INTERVAL_HOURS * 3600)

    _reminder_task = asyncio.create_task(_loop())
    logger.info(f"AI提醒调度器已创建（间隔: {_SCAN_INTERVAL_HOURS}h）")
    return _reminder_task


async def stop_reminder_scheduler():
    """停止定时提醒调度器"""
    global _reminder_task
    if _reminder_task:
        _reminder_task.cancel()
        try:
            await _reminder_task
        except asyncio.CancelledError:
            pass
        _reminder_task = None
        logger.info("AI提醒调度器已停止")


# ========== AI 上下文注入（让AI在对话中也能主动提醒） ==========

async def get_ai_reminder_context(tenant_id: str) -> str | None:
    """
    生成AI上下文摘要，注入到聊天对话中。
    让AI在回答用户问题时，顺带主动提及待处理事项。
    """
    await asyncio.sleep(0)  # 让出事件循环
    try:
        async with database.pool.acquire() as conn:
            # 待审批数
            pending_count = await conn.fetchval(
                "SELECT count(*) FROM biz_finance WHERE tenant_id=$1 AND status='pending'",
                tenant_id,
            )
            # 超期任务数
            overdue_count = await conn.fetchval(
                """SELECT count(*) FROM tasks
                   WHERE tenant_id=$1 AND due_date < CURRENT_DATE
                     AND task_status NOT IN ('completed', 'delayed')
                     AND record_status='active'""",
                tenant_id,
            )
            # 今日签到情况
            today_checkin = await conn.fetchval(
                """SELECT count(DISTINCT user_id) FROM attendance
                   WHERE check_time::date = CURRENT_DATE""",
            )

        if pending_count == 0 and overdue_count == 0 and today_checkin and today_checkin > 0:
            return None

        lines = ["[灵境主动提醒：当前有以下事项需要注意]"]
        if pending_count:
            lines.append(f"· {pending_count}笔待审批申请等待处理")
        if overdue_count:
            lines.append(f"· {overdue_count}个任务已超期")
        if not today_checkin:
            lines.append("· 今日尚无人签到打卡")

        lines.append("请在回复中自然地提醒用户处理这些事项，不要太生硬。")
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"生成AI提醒上下文失败: {e}")
        return None
