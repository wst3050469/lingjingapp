"""用户管理路由"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from services import UserService
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db
import hashlib

router = APIRouter(prefix="/api/users", tags=["用户管理"])
user_service = UserService()

class UserCreate(BaseModel):
    tenant_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    roles: Optional[List[str]] = None
    position: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None

class LoginRequest(BaseModel):
    phone: str
    password: str

@router.post("/register")
async def register(req: UserCreate):
    """创建用户"""
    result = await user_service.create_user(
        tenant_id=req.tenant_id,
        name=req.name,
        phone=req.phone,
        email=req.email,
        roles=req.roles,
        position=req.position,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/login")
async def login(req: LoginRequest):
    """用户登录"""
    user = await user_service.get_user_by_phone(req.phone)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    password_hash = hashlib.sha256(req.password.encode()).hexdigest()
    if user["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="密码错误")

    # 更新最后登录时间
    await db.execute(
        "UPDATE users SET last_login_at = NOW() WHERE id = $1",
        (user["id"],)
    )

    return {
        "success": True,
        "user_id": str(user["id"]),
        "name": user["name"],
        "roles": user["roles"],
    }

@router.get("/{user_id}")
async def get_user(user_id: str):
    """获取用户信息"""
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user

@router.get("/")
async def list_users(tenant_id: str, role: Optional[str] = None):
    """获取用户列表"""
    users = await user_service.list_users(tenant_id, role)
    return {"users": users, "total": len(users)}

@router.put("/{user_id}")
async def update_user(user_id: str, req: UserUpdate):
    """更新用户"""
    fields = req.model_dump(exclude_none=True)
    if fields:
        await user_service.update_user(user_id, **fields)
    return {"success": True}

@router.delete("/{user_id}")
async def delete_user(user_id: str):
    """删除用户"""
    await user_service.delete_user(user_id)
    return {"success": True}
