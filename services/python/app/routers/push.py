"""灵境平台 - 推送注册API"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from .auth import get_current_user
from services.push_service import register_push_token

router = APIRouter(prefix="/api/v1/push", tags=["push"])


class RegisterPushRequest(BaseModel):
    push_token: str
    platform: str = "android"


@router.post("/register")
async def register_push(req: RegisterPushRequest, user: dict = Depends(get_current_user)):
    username = user.get("code", "").replace("u_", "")
    if not username:
        raise HTTPException(status_code=400, detail="无法识别用户")

    ok = await register_push_token(username, req.push_token, req.platform)
    if ok:
        return {"code": 0, "msg": "推送注册成功"}
    else:
        raise HTTPException(status_code=500, detail="推送注册失败")
