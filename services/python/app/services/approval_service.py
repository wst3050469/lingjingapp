"""审批服务"""
from typing import Optional, List, Dict
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db
import logging

logger = logging.getLogger("lingjing.approval")

class ApprovalService:
    """审批服务"""

    async def create_approval(self, tenant_id: str, applicant_id: str,
                              title: str, amount: float = 0,
                              type: str = "general", **config) -> Dict:
        """创建审批"""
        record_id = await db.insert(
            """INSERT INTO approvals
               (tenant_id, applicant_id, title, amount, status, flow_id)
               VALUES ($1, $2, $3, $4, 'pending',
                       (SELECT id FROM approval_flows WHERE tenant_id = $1 AND object_type = $5 LIMIT 1))
               RETURNING id""",
            (tenant_id, applicant_id, title, amount, type)
        )

        # 通知租户管理员：有新审批
        try:
            from services.notification_service import notify
            await notify(
                tenant_id=tenant_id,
                event_type="approval_created",
                title="📋 新审批申请",
                body=f"{title} - ¥{amount:,.0f}" if amount else title,
                ref_type="approval",
                ref_id=str(record_id),
                extras={"applicant_id": applicant_id, "amount": amount, "title": title},
            )
        except Exception as e:
            logger.warning(f"审批通知发送失败: {e}")

        return {
            "success": True,
            "approval_id": record_id,
            "title": title,
        }

    async def get_approval(self, approval_id: str) -> Optional[Dict]:
        """获取审批"""
        return await db.fetchone(
            """SELECT a.*, u.name as applicant_name
               FROM approvals a
               LEFT JOIN users u ON a.applicant_id = u.id
               WHERE a.id = $1""",
            (approval_id,)
        )

    async def list_pending(self, tenant_id: str) -> List[Dict]:
        """获取待审批列表"""
        return await db.fetchall(
            """SELECT a.*, u.name as applicant_name
               FROM approvals a
               LEFT JOIN users u ON a.applicant_id = u.id
               WHERE a.tenant_id = $1 AND a.status = 'pending'
               ORDER BY a.created_at DESC""",
            (tenant_id,)
        )

    async def approve(self, approval_id: str, approver_id: str,
                       comment: str = None) -> Dict:
        """审批通过"""
        result = await db.fetchone(
            """UPDATE approvals
               SET status = 'approved', resolved_at = NOW()
               WHERE id = $1
               RETURNING *""",
            (approval_id,)
        )
        # 通知申请人
        try:
            from services.notification_service import notify
            await notify(
                tenant_id=result.get("tenant_id", ""),
                event_type="approval_approved",
                title="✅ 审批已通过",
                body=f"「{result.get('title', '')}」已批准",
                ref_type="approval",
                ref_id=str(approval_id),
                extras={"applicant_id": result.get("applicant_id", ""),
                        "approver_id": approver_id, "amount": result.get("amount", 0)},
            )
        except Exception as e:
            logger.warning(f"审批通知发送失败: {e}")
        return result

    async def reject(self, approval_id: str, approver_id: str,
                      comment: str = None) -> Dict:
        """审批驳回"""
        result = await db.fetchone(
            """UPDATE approvals
               SET status = 'rejected', resolved_at = NOW()
               WHERE id = $1
               RETURNING *""",
            (approval_id,)
        )
        # 通知申请人
        try:
            from services.notification_service import notify
            await notify(
                tenant_id=result.get("tenant_id", ""),
                event_type="approval_rejected",
                title="❌ 审批已驳回",
                body=f"「{result.get('title', '')}」被驳回" + (f": {comment}" if comment else ""),
                ref_type="approval",
                ref_id=str(approval_id),
                extras={"applicant_id": result.get("applicant_id", ""),
                        "approver_id": approver_id, "amount": result.get("amount", 0)},
            )
        except Exception as e:
            logger.warning(f"审批通知发送失败: {e}")
        return result
