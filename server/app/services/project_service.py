"""项目管理服务"""
from typing import Optional, List, Dict
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db
import logging

logger = logging.getLogger("lingjing.project")

class ProjectService:
    """项目管理服务"""

    def __init__(self):
        self._no_counter = {}

    def _generate_no(self, tenant_id: str) -> str:
        """生成项目编号"""
        if tenant_id not in self._no_counter:
            self._no_counter[tenant_id] = 0

        self._no_counter[tenant_id] += 1
        return f"PRJ-{self._no_counter[tenant_id]:06d}"

    async def create_project(self, tenant_id: str, name: str,
                             manager_id: str = None, **config) -> Dict:
        """创建项目"""
        no = self._generate_no(tenant_id)

        project_id = await db.insert(
            """INSERT INTO projects
               (tenant_id, name, no, manager_id, status, config)
               VALUES ($1, $2, $3, $4, 'pending', $5)
               RETURNING id""",
            (tenant_id, name, no, manager_id, config)
        )

        # 如果有负责人，自动添加到项目
        if manager_id:
            await db.execute(
                """INSERT INTO project_members (project_id, user_id, role)
                   VALUES ($1, $2, 'owner')""",
                (project_id, manager_id)
            )

        # 通知管理员
        try:
            from services.notification_service import notify
            await notify(
                tenant_id=tenant_id,
                event_type="project_created",
                title=f"🏗️ 新项目「{name}」已创建",
                body=f"编号: {no}",
                ref_type="project",
                ref_id=str(project_id),
                extras={"project_name": name, "project_no": no, "manager_id": manager_id},
            )
        except Exception as e:
            logger.warning(f"项目通知发送失败: {e}")

        return {
            "success": True,
            "project_id": project_id,
            "no": no,
            "name": name,
        }

    async def get_project(self, project_id: str) -> Optional[Dict]:
        """获取项目"""
        return await db.fetchone(
            "SELECT * FROM projects WHERE id = $1 AND status = 'active'",
            (project_id,)
        )

    async def list_projects(self, tenant_id: str, status: str = None) -> List[Dict]:
        """获取项目列表"""
        if status:
            return await db.fetchall(
                """SELECT * FROM projects
                   WHERE tenant_id = $1 AND status = $2 AND deleted_at IS NULL
                   ORDER BY created_at DESC""",
                (tenant_id, status)
            )
        return await db.fetchall(
            """SELECT * FROM projects
               WHERE tenant_id = $1 AND deleted_at IS NULL
               ORDER BY created_at DESC""",
            (tenant_id,)
        )

    async def get_user_projects(self, user_id: str) -> List[Dict]:
        """获取用户参与的项目"""
        return await db.fetchall(
            """SELECT p.*, pm.role as member_role
               FROM projects p
               JOIN project_members pm ON p.id = pm.project_id
               WHERE pm.user_id = $1 AND p.deleted_at IS NULL
               ORDER BY p.created_at DESC""",
            (user_id,)
        )

    async def add_member(self, project_id: str, user_id: str, role: str = "member") -> bool:
        """添加项目成员"""
        await db.execute(
            """INSERT INTO project_members (project_id, user_id, role)
               VALUES ($1, $2, $3)
               ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3""",
            (project_id, user_id, role)
        )
        # 通知被添加的成员
        try:
            project = await db.fetchone(
                "SELECT tenant_id, name FROM projects WHERE id=$1", (project_id,)
            )
            if project:
                from services.notification_service import notify
                await notify(
                    tenant_id=project.get("tenant_id", ""),
                    event_type="member_added",
                    title=f"🔗 您已被加入项目「{project.get('name', '')}」",
                    body=f"角色: {role}",
                    target_user_ids=[str(user_id)],
                    ref_type="project",
                    ref_id=str(project_id),
                    extras={"role": role, "project_name": project.get("name", "")},
                )
        except Exception as e:
            logger.warning(f"成员通知发送失败: {e}")
        return True

    async def remove_member(self, project_id: str, user_id: str) -> bool:
        """移除项目成员"""
        await db.execute(
            "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2",
            (project_id, user_id)
        )
        return True

    async def get_members(self, project_id: str) -> List[Dict]:
        """获取项目成员"""
        return await db.fetchall(
            """SELECT u.id, u.name, u.phone, u.roles, pm.role, pm.joined_at
               FROM users u
               JOIN project_members pm ON u.id = pm.user_id
               WHERE pm.project_id = $1 AND u.status = 'active'""",
            (project_id,)
        )

    async def update_progress(self, project_id: str, progress: float) -> Dict:
        """更新项目进度"""
        return await db.fetchone(
            """UPDATE projects
               SET progress = $2, updated_at = NOW()
               WHERE id = $1
               RETURNING *""",
            (project_id, min(100, max(0, progress)))
        )

    async def update_status(self, project_id: str, status: str) -> Dict:
        """更新项目状态"""
        return await db.fetchone(
            """UPDATE projects
               SET status = $2, updated_at = NOW()
               WHERE id = $1
               RETURNING *""",
            (project_id, status)
        )
