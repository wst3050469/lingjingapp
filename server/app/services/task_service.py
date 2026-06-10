"""任务管理服务"""
from typing import Optional, List, Dict
from datetime import datetime
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db
import logging

logger = logging.getLogger("lingjing.task")

class TaskService:
    """任务管理服务"""

    async def create_task(self, tenant_id: str, title: str,
                          project_id: str = None, assignee_id: str = None,
                          creator_id: str = None, due_date: str = None,
                          priority: str = "normal", **config) -> Dict:
        """创建任务"""
        record_id = await db.insert(
            """INSERT INTO tasks
               (tenant_id, project_id, title, assignee_id, creator_id,
                due_date, priority, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
               RETURNING id""",
            (tenant_id, project_id, title, assignee_id, creator_id,
             due_date, priority)
        )

        # 通知被分配人
        if assignee_id:
            try:
                from services.notification_service import notify
                await notify(
                    tenant_id=tenant_id,
                    event_type="task_assigned",
                    title=f"📋 新任务分配: {title}",
                    body=f"优先级: {priority}" + (f", 截止: {due_date}" if due_date else ""),
                    target_user_ids=[str(assignee_id)],
                    ref_type="task",
                    ref_id=str(record_id),
                    extras={"assignee_id": str(assignee_id), "priority": priority, "due_date": due_date},
                )
            except Exception as e:
                logger.warning(f"任务通知发送失败: {e}")

        return {
            "success": True,
            "task_id": record_id,
            "title": title,
        }

    async def get_task(self, task_id: str) -> Optional[Dict]:
        """获取任务"""
        return await db.fetchone(
            """SELECT t.*, u.name as assignee_name, p.name as project_name
               FROM tasks t
               LEFT JOIN users u ON t.assignee_id = u.id
               LEFT JOIN projects p ON t.project_id = p.id
               WHERE t.id = $1 AND t.status = 'active'""",
            (task_id,)
        )

    async def list_tasks(self, tenant_id: str, assignee_id: str = None,
                         project_id: str = None, status: str = None) -> List[Dict]:
        """获取任务列表"""
        conditions = ["t.tenant_id = $1", "t.status = 'active'"]
        params = [tenant_id]
        idx = 2

        if assignee_id:
            conditions.append(f"t.assignee_id = ${idx}")
            params.append(assignee_id)
            idx += 1

        if project_id:
            conditions.append(f"t.project_id = ${idx}")
            params.append(project_id)
            idx += 1

        if status:
            conditions.append(f"t.status = ${idx}")
            params.append(status)
            idx += 1

        sql = f"""SELECT t.*, u.name as assignee_name, p.name as project_name
                  FROM tasks t
                  LEFT JOIN users u ON t.assignee_id = u.id
                  LEFT JOIN projects p ON t.project_id = p.id
                  WHERE {' AND '.join(conditions)}
                  ORDER BY t.created_at DESC"""

        return await db.fetchall(sql, tuple(params))

    async def assign_task(self, task_id: str, assignee_id: str) -> Dict:
        """指派任务"""
        result = await db.fetchone(
            """UPDATE tasks SET assignee_id = $2, updated_at = NOW()
               WHERE id = $1 RETURNING *""",
            (task_id, assignee_id)
        )
        # 通知被分配人
        if result and assignee_id:
            try:
                from services.notification_service import notify
                await notify(
                    tenant_id=result.get("tenant_id", ""),
                    event_type="task_assigned",
                    title=f"📋 您有新任务: {result.get('title', '')}",
                    body="请及时处理",
                    target_user_ids=[str(assignee_id)],
                    ref_type="task",
                    ref_id=str(task_id),
                    extras={"assignee_id": str(assignee_id)},
                )
            except Exception as e:
                logger.warning(f"任务通知发送失败: {e}")
        return result

    async def update_status(self, task_id: str, status: str) -> Dict:
        """更新任务状态"""
        completed_at = datetime.now() if status == "completed" else None
        result = await db.fetchone(
            """UPDATE tasks
               SET status = $2, updated_at = NOW(), completed_at = $3
               WHERE id = $1 RETURNING *""",
            (task_id, status, completed_at)
        )
        # 任务完成时通知项目管理者
        if result and status == "completed":
            try:
                from services.notification_service import notify
                await notify(
                    tenant_id=result.get("tenant_id", ""),
                    event_type="task_completed",
                    title=f"✅ 任务完成: {result.get('title', '')}",
                    body="请检查确认",
                    ref_type="task",
                    ref_id=str(task_id),
                    extras={"project_id": str(result.get("project_id", ""))},
                )
            except Exception as e:
                logger.warning(f"任务通知发送失败: {e}")
        return result

    async def update_progress(self, task_id: str, progress: float) -> Dict:
        """更新任务进度"""
        return await db.fetchone(
            """UPDATE tasks SET progress = $2, updated_at = NOW()
               WHERE id = $1 RETURNING *""",
            (task_id, min(100, max(0, progress)))
        )
