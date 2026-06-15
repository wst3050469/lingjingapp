from typing import Optional, List, Dict

class ApprovalService:
    def __init__(self): pass
    async def create_approval(self, tenant_id, applicant_id, title, amount=0, type='general'):
        return {'id': 'stub', 'status': 'pending'}
    async def get_approvals(self, tenant_id):
        return []
    async def action_approval(self, approval_id, approver_id, action, comment=None):
        return {'id': approval_id, 'status': action}
