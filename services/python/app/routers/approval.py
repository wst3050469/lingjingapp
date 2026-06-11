"""审批路由"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services import ApprovalService

router = APIRouter(prefix="/api/approvals", tags=["审批管理"])
approval_service = ApprovalService()

class ApprovalCreate(BaseModel):
    tenant_id: str
    applicant_id: str
    title: str
    amount: Optional[float] = 0
    type: Optional[str] = "general"

class ApprovalAction(BaseModel):
    approver_id: str
    comment: Optional[str] = None

@router.post("/")
async def create_approval(req: ApprovalCreate):
    """创建审批"""
    result = await approval_service.create_approval(
        tenant_id=req.tenant_id,
        applicant_id=req.applicant_id,
        title=req.title,
        amount=req.amount,
        type=req.type,
    )
    return result

@router.get("/{approval_id}")
async def get_approval(approval_id: str):
    """获取审批"""
    approval = await approval_service.get_approval(approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="审批不存在")
    return approval

@router.get("/")
async def list_pending(tenant_id: str):
    """获取待审批列表"""
    approvals = await approval_service.list_pending(tenant_id)
    return {"approvals": approvals, "total": len(approvals)}

@router.post("/{approval_id}/approve")
async def approve(approval_id: str, req: ApprovalAction):
    """审批通过"""
    approval = await approval_service.approve(approval_id, req.approver_id, req.comment)
    return approval

@router.post("/{approval_id}/reject")
async def reject(approval_id: str, req: ApprovalAction):
    """审批驳回"""
    approval = await approval_service.reject(approval_id, req.approver_id, req.comment)
    return approval
