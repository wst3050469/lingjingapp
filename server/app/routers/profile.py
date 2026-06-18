"""灵境平台 - 用户资料路由"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, Depends
import db as database
from .auth import get_current_user
from services.industry_config import get_welcome_chips, get_personal_chips, get_industry_config
from services.context_builder import get_team_notifications

router = APIRouter(prefix="/api/v1/user", tags=["user-profile"])


@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    """获取当前用户完整资料，包括欢迎引导语"""
    tenant_id = user.get("tenant_id")
    industry_code = user.get("industry")

    # 根据是否有租户决定 chips
    if tenant_id:
        role = user.get("tenant_role") or "member"
        welcome_chips = get_welcome_chips(industry_code or "", role=role)
    else:
        welcome_chips = get_personal_chips()

    # 行业信息
    industry_info = None
    if industry_code:
        cfg = get_industry_config(industry_code)
        if cfg:
            industry_info = {"code": cfg["code"], "name": cfg["name"]}

    # 查询 account_type
    account_type = "personal"
    code = user.get("code", "")
    if code.startswith("u_"):
        username = code[2:]
        async with database.pool.acquire() as conn:
            row = await conn.fetchval(
                "SELECT account_type FROM users WHERE username=$1", username,
            )
            if row:
                account_type = row

    # 管理员的待处理通知
    pending_notifications = []
    if tenant_id and role in ("owner", "admin"):
        _NOTIF_TPL = {
            "new_member": (
                "新成员「{name}」通过邀请码加入了团队，待分配角色",
                "帮我给{name}分配角色",
                "person_add",
            ),
        }
        notifs = await get_team_notifications(tenant_id)
        for n in notifs:
            tpl = _NOTIF_TPL.get(n["type"])
            if tpl:
                name = n["target_user_name"] or n["target_user_id"]
                pending_notifications.append({
                    "type": n["type"],
                    "message": tpl[0].format(name=name),
                    "action_prompt": tpl[1].format(name=name),
                    "icon": tpl[2],
                })

    return {
        "code": 0,
        "user_id": user.get("code", "").replace("u_", ""),  # 当前用户名
        "nickname": user.get("nickname", ""),
        "tenant_id": tenant_id,
        "company_name": user.get("company_name"),
        "tenant_role": user.get("tenant_role"),
        "owner_name": user.get("owner_name"),
        "industry": industry_info,
        "account_type": account_type,
        "welcome_chips": welcome_chips,
        "pending_notifications": pending_notifications,
    }
