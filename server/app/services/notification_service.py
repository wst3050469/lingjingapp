"""
灵境 - 统一通知中心服务
负责：业务事件 → 通知路由(按角色) → 写入通知表 + 待办项 + WS推送
核心理念：每个业务动作都有对应的通知接收人，不遗漏任何一环
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

logger = logging.getLogger("lingjing.notification")

# ========== 事件类型 → 通知目标角色映射 ==========
# route_rules: {event_type: [role1, role2, ...]}
# 特殊值: "applicant" = 申请人, "assignee" = 被分配人, "approver" = 当前审批人
EVENT_ROUTE = {
    # 财务相关 → 租户管理员
    "expense_submitted":       ["owner", "admin"],
    "fund_requested":          ["owner", "admin"],
    "wage_submitted":          ["owner", "admin"],
    # 审批相关
    "approval_created":        ["owner", "admin"],           # 新审批 → 管理员
    "approval_approved":       ["applicant"],                # 审批通过 → 申请人
    "approval_rejected":       ["applicant"],                # 审批拒绝 → 申请人
    # 项目相关
    "project_created":         ["owner", "admin"],
    "project_updated":         ["project_manager"],
    "project_overdue":         ["owner", "admin", "project_manager"],
    # 任务相关
    "task_assigned":           ["assignee", "project_manager"],
    "task_completed":          ["project_manager"],
    "task_overdue":            ["assignee", "project_manager"],
    # 客户相关
    "customer_stale":          ["owner", "admin"],
    "customer_added":          ["owner", "admin", "project_manager"],
    # 考勤相关
    "attendance_anomaly":      ["owner", "admin", "project_manager"],
    # 自动化任务
    "automation_task":         ["owner", "admin"],            # 自动化任务报告
    # 系统通知
    "system_announcement":     ["*"],                         # 全员
    "ai_reminder":             ["owner", "admin"],            # AI主动提醒
    "member_added":            ["owner", "admin"],
    "role_changed":            ["owner", "admin"],
}

# 优先级常量
PRIORITY_URGENT = 100    # 紧急：超期/被拒/审批
PRIORITY_HIGH = 80       # 高：新审批/新任务
PRIORITY_NORMAL = 50     # 普通：进度更新
PRIORITY_LOW = 20        # 低：系统通知

EVENT_PRIORITY = {
    "project_overdue":       PRIORITY_URGENT,
    "task_overdue":          PRIORITY_URGENT,
    "approval_rejected":     PRIORITY_URGENT,
    "expense_submitted":     PRIORITY_HIGH,
    "fund_requested":        PRIORITY_HIGH,
    "approval_created":      PRIORITY_HIGH,
    "task_assigned":         PRIORITY_HIGH,
    "approval_approved":     PRIORITY_NORMAL,
    "project_created":       PRIORITY_NORMAL,
    "project_updated":       PRIORITY_NORMAL,
    "task_completed":        PRIORITY_NORMAL,
    "customer_stale":        PRIORITY_NORMAL,
    "customer_added":        PRIORITY_NORMAL,
    "system_announcement":   PRIORITY_LOW,
    "ai_reminder":           PRIORITY_NORMAL,
    "automation_task":       PRIORITY_NORMAL,
    "member_added":          PRIORITY_LOW,
    "role_changed":          PRIORITY_LOW,
}


async def notify(
    tenant_id: str,
    event_type: str,
    title: str,
    body: str = "",
    target_user_ids: Optional[list[str]] = None,
    ref_type: str = "",
    ref_id: str = "",
    extras: Optional[dict] = None,
    priority: Optional[int] = None,
) -> dict:
    """
    统一通知入口

    Args:
        tenant_id: 租户ID
        event_type: 事件类型 (见 EVENT_ROUTE)
        title: 通知标题
        body: 通知正文
        target_user_ids: 指定目标用户ID列表（可选，为空则按角色路由）
        ref_type: 关联业务类型 (approval/task/project/customer 等)
        ref_id: 关联业务ID
        extras: 额外数据 (用于推送和待办)
        priority: 优先级 (可选，默认从 EVENT_PRIORITY 取)

    Returns:
        {"notified": [user_id, ...], "todo_count": N, "ws_delivered": N}
    """
    if priority is None:
        priority = EVENT_PRIORITY.get(event_type, PRIORITY_NORMAL)

    # 1. 确定目标用户
    if target_user_ids:
        final_user_ids = target_user_ids
    else:
        final_user_ids = await _resolve_targets(tenant_id, event_type, extras or {})

    if not final_user_ids:
        logger.info(f"通知无目标: event={event_type} tenant={tenant_id}")
        return {"notified": [], "todo_count": 0, "ws_delivered": 0}

    # 2. 写入通知表 + 更新待办计数
    for uid in final_user_ids:
        try:
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO notifications
                       (tenant_id, target_user_id, event_type, title, body,
                        ref_type, ref_id, priority, extras, is_read, created_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NOW())""",
                    tenant_id, uid, event_type, title, body,
                    ref_type, ref_id, priority,
                    json.dumps(extras or {}, ensure_ascii=False),
                )
                # 更新用户待办计数缓存
                await conn.execute(
                    """INSERT INTO user_todo_counts (user_id, unread_count, updated_at)
                       VALUES ($1, 1, NOW())
                       ON CONFLICT (user_id) DO UPDATE
                       SET unread_count = user_todo_counts.unread_count + 1,
                           updated_at = NOW()""",
                    uid,
                )
        except Exception as e:
            logger.warning(f"写入通知失败 user={uid}: {e}")

    # 3. WebSocket 实时推送
    ws_count = 0
    try:
        from services.ws_manager import ConnectionManager
        for uid in final_user_ids:
            push_data = {
                "type": "notification",
                "event_type": event_type,
                "title": title,
                "body": body,
                "ref_type": ref_type,
                "ref_id": ref_id,
                "priority": priority,
                "extras": extras or {},
            }
            if await ConnectionManager.send_json(uid, push_data):
                ws_count += 1
    except Exception as e:
        logger.warning(f"WS推送失败: {e}")

    logger.info(f"通知完成: event={event_type} targets={len(final_user_ids)} ws={ws_count}")
    return {
        "notified": final_user_ids,
        "todo_count": len(final_user_ids),
        "ws_delivered": ws_count,
    }


async def _resolve_targets(tenant_id: str, event_type: str, extras: dict) -> list[str]:
    """根据事件类型和角色规则，解析通知目标用户列表（同时支持租户用户ID和邀请码ID）"""
    roles = EVENT_ROUTE.get(event_type, [])
    if not roles:
        return []

    user_ids = set()

    async with database.pool.acquire() as conn:
        for role in roles:
            if role == "*":
                # 全员：从 tenant_users 取
                rows = await conn.fetch(
                    "SELECT user_id, name FROM tenant_users WHERE tenant_id=$1 AND status='active'",
                    tenant_id,
                )
                for r in rows:
                    user_ids.add(r["user_id"])
                    # 同时查找 invite_codes 中的匹配
                    ic_row = await conn.fetchrow(
                        "SELECT code FROM invite_codes WHERE nickname=$1 AND status='active' LIMIT 1",
                        r["name"],
                    )
                    if ic_row:
                        user_ids.add(ic_row["code"])

            elif role == "applicant":
                aid = extras.get("applicant_id") or extras.get("applicant")
                if aid:
                    user_ids.add(str(aid))

            elif role == "assignee":
                aid = extras.get("assignee_id") or extras.get("assignee")
                if aid:
                    user_ids.add(str(aid))

            elif role == "approver":
                aid = extras.get("approver_id") or extras.get("approver")
                if aid:
                    user_ids.add(str(aid))

            elif role == "project_manager":
                project_id = extras.get("project_id")
                if project_id:
                    try:
                        pid = int(project_id)
                        pm_rows = await conn.fetch(
                            """SELECT user_id FROM project_members
                               WHERE project_id=$1 AND role='manager'""",
                            pid,
                        )
                        for r in pm_rows:
                            user_ids.add(str(r["user_id"]))
                    except (ValueError, TypeError):
                        pass
                # 也加入角色为 project_manager 的成员
                pm2 = await conn.fetch(
                    """SELECT tu.user_id, tu.name FROM tenant_users tu
                       WHERE tu.tenant_id=$1 AND tu.role='project_manager'""",
                    tenant_id,
                )
                for r in pm2:
                    user_ids.add(r["user_id"])
                    # 同时查找 invite_codes
                    ic_row = await conn.fetchrow(
                        "SELECT code FROM invite_codes WHERE nickname=$1 AND status='active' LIMIT 1",
                        r["name"],
                    )
                    if ic_row:
                        user_ids.add(ic_row["code"])

            else:
                # 按租户角色查找
                rows = await conn.fetch(
                    """SELECT user_id, name FROM tenant_users
                       WHERE tenant_id=$1 AND role=$2 AND status='active'""",
                    tenant_id, role,
                )
                for r in rows:
                    user_ids.add(r["user_id"])
                    # 同时查找 invite_codes 中的匹配 (by name)
                    ic_row = await conn.fetchrow(
                        "SELECT code FROM invite_codes WHERE nickname=$1 AND status='active' LIMIT 1",
                        r["name"],
                    )
                    if ic_row:
                        user_ids.add(ic_row["code"])

    return list(user_ids)


# ========== 待办中心API辅助 ==========

async def get_unread_count(user_id: str) -> int:
    """获取用户未读通知数（红点数字，合并 notifications + tenant_notifications）"""
    async with database.pool.acquire() as conn:
        # A. notifications 表
        real_cnt = await conn.fetchval(
            "SELECT COUNT(*) FROM notifications WHERE target_user_id=$1 AND is_read=FALSE",
            user_id,
        )
        # B. tenant_notifications 表（管理员看租户级待处理通知）
        tu = await conn.fetchrow(
            "SELECT tenant_id, role FROM tenant_users WHERE user_id=$1 AND status='active'",
            user_id,
        )
        extra = 0
        if tu and tu["role"] in ("owner", "admin"):
            extra = await conn.fetchval(
                "SELECT COUNT(*) FROM tenant_notifications WHERE tenant_id=$1 AND status='pending'",
                tu["tenant_id"],
            )
        total = (real_cnt or 0) + (extra or 0)

        # 同步缓存
        await conn.execute(
            """INSERT INTO user_todo_counts (user_id, unread_count, updated_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT (user_id) DO UPDATE SET unread_count=$2, updated_at=NOW()""",
            user_id, total,
        )
        return total


async def get_notifications(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    event_type: str = "",
    is_read: Optional[bool] = None,
) -> list[dict]:
    """获取用户通知列表（合并 notifications + tenant_notifications 双表）
    
    策略：先查双表全量 → 合并排序 → 再截断。
    避免 tenant_notifications 被大量自动化通知挤出 limit 窗口。
    """
    results: list[dict] = []

    async with database.pool.acquire() as conn:
        # ── A. notifications 表（取足够多，合并后再截断） ──
        conditions = ["target_user_id=$1"]
        params: list = [user_id]
        idx = 2

        if event_type:
            conditions.append(f"event_type=${idx}")
            params.append(event_type)
            idx += 1
        if is_read is not None:
            conditions.append(f"is_read=${idx}")
            params.append(is_read)
            idx += 1

        # 始终多取一些，防 tenant_notifications 被淹没
        fetch_limit = max(limit * 2, 200)
        params.append(fetch_limit)
        limit_idx = idx
        params.append(offset)
        offset_idx = idx + 1

        rows = await conn.fetch(
            f"""SELECT id, event_type, title, body, ref_type, ref_id,
                       priority, is_read, created_at, extras
                FROM notifications
                WHERE {' AND '.join(conditions)}
                ORDER BY created_at DESC
                LIMIT ${limit_idx} OFFSET ${offset_idx}""",
            *params,
        )
        for r in rows:
            results.append({
                "id": r["id"],
                "event_type": r["event_type"],
                "title": r["title"],
                "body": r["body"],
                "ref_type": r["ref_type"],
                "ref_id": r["ref_id"],
                "priority": r["priority"],
                "is_read": r["is_read"],
                "created_at": r["created_at"].isoformat(),
                "extras": json.loads(r["extras"]) if isinstance(r["extras"], str) else (r["extras"] or {}),
                "source": "notification",
            })

        # ── B. tenant_notifications 表（桥接：管理员看到租户级通知） ──
        tu = await conn.fetchrow(
            "SELECT tenant_id, role FROM tenant_users WHERE user_id=$1 AND status='active'",
            user_id,
        )
        if not tu:
            ic = await conn.fetchrow(
                "SELECT code FROM invite_codes WHERE code=$1 AND status='active'", user_id,
            )
            if not ic:
                return sorted(results, key=lambda x: x["created_at"], reverse=True)[:limit]

        if tu and tu["role"] in ("owner", "admin"):
            tn_rows = await conn.fetch(
                """SELECT id, type, target_user_id, target_user_name, data, status, created_at
                   FROM tenant_notifications
                   WHERE tenant_id=$1
                   ORDER BY created_at DESC LIMIT 30""",
                tu["tenant_id"],
            )
            for r in tn_rows:
                is_pending = r["status"] == "pending"
                is_read_val = not is_pending
                if is_read is not None and is_read != (not is_read_val):
                    continue
                # 待处理的租户通知置顶（85→最高），已处理的降为普通(50)
                prio = 85 if is_pending else 50
                display_time = datetime.now(timezone.utc) if is_pending else r["created_at"]
                results.append({
                    "id": 90000 + r["id"],
                    "event_type": r["type"],
                    "title": "新成员加入",
                    "body": f"新成员「{r['target_user_name']}」通过邀请码加入了团队，待分配角色",
                    "ref_type": "tenant_user",
                    "ref_id": r["target_user_id"],
                    "priority": prio,
                    "is_read": is_read_val,
                    "created_at": display_time.isoformat(),
                    "extras": {
                        "new_user_id": r["target_user_id"],
                        "new_user_name": r["target_user_name"],
                    },
                    "source": "tenant_notification",
                })

    # 合并排序（priority 降序 → created_at 降序）、截断
    results.sort(key=lambda x: (x["priority"], x["created_at"]), reverse=True)
    return results[:limit]


async def mark_read(user_id: str, notification_id: int) -> bool:
    """标记单条通知已读（支持双表）"""
    async with database.pool.acquire() as conn:
        if notification_id >= 90000:
            # tenant_notifications 表
            real_id = notification_id - 90000
            # 验证用户是该租户的管理员
            tn = await conn.fetchrow(
                "SELECT tenant_id, status FROM tenant_notifications WHERE id=$1", real_id,
            )
            if not tn or tn["status"] != "pending":
                return False
            tu = await conn.fetchrow(
                "SELECT role FROM tenant_users WHERE user_id=$1 AND tenant_id=$2 AND status='active'",
                user_id, tn["tenant_id"],
            )
            if not tu or tu["role"] not in ("owner", "admin"):
                return False
            await conn.execute(
                "UPDATE tenant_notifications SET status='delivered' WHERE id=$1", real_id,
            )
            # 更新计数缓存
            await conn.execute(
                """UPDATE user_todo_counts SET unread_count = GREATEST(0, unread_count - 1),
                   updated_at = NOW() WHERE user_id=$1""",
                user_id,
            )
            return True

        # notifications 表
        result = await conn.execute(
            """UPDATE notifications SET is_read=TRUE
               WHERE id=$1 AND target_user_id=$2 AND is_read=FALSE""",
            notification_id, user_id,
        )
        affected = int(result.split()[-1]) if result else 0
        if affected > 0:
            await conn.execute(
                """UPDATE user_todo_counts SET unread_count = GREATEST(0, unread_count - 1),
                   updated_at = NOW() WHERE user_id=$1""",
                user_id,
            )
        return affected > 0


async def mark_all_read(user_id: str) -> int:
    """全部标记已读（双表）"""
    total = 0
    async with database.pool.acquire() as conn:
        # notifications 表
        result = await conn.execute(
            "UPDATE notifications SET is_read=TRUE WHERE target_user_id=$1 AND is_read=FALSE",
            user_id,
        )
        total += int(result.split()[-1]) if result else 0

        # tenant_notifications 表（管理员角色）
        tu = await conn.fetchrow(
            "SELECT tenant_id, role FROM tenant_users WHERE user_id=$1 AND status='active'",
            user_id,
        )
        if tu and tu["role"] in ("owner", "admin"):
            result2 = await conn.execute(
                "UPDATE tenant_notifications SET status='delivered' WHERE tenant_id=$1 AND status='pending'",
                tu["tenant_id"],
            )
            total += int(result2.split()[-1]) if result2 else 0

        await conn.execute(
            "UPDATE user_todo_counts SET unread_count=0, updated_at=NOW() WHERE user_id=$1",
            user_id,
        )
        return total
