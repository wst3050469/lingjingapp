"""项目管理路由"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from services import ProjectService

router = APIRouter(prefix="/api/projects", tags=["项目管理"])
project_service = ProjectService()

class ProjectCreate(BaseModel):
    tenant_id: str
    name: str
    manager_id: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[str] = None
    deadline: Optional[str] = None

class MemberAdd(BaseModel):
    user_id: str
    role: str = "member"

@router.post("/")
async def create_project(req: ProjectCreate):
    """创建项目"""
    result = await project_service.create_project(
        tenant_id=req.tenant_id,
        name=req.name,
        manager_id=req.manager_id,
        budget=req.budget,
    )
    return result

@router.get("/{project_id}")
async def get_project(project_id: str):
    """获取项目"""
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project

@router.get("/")
async def list_projects(tenant_id: str, status: Optional[str] = None):
    """获取项目列表"""
    projects = await project_service.list_projects(tenant_id, status)
    return {"projects": projects, "total": len(projects)}

@router.get("/user/{user_id}")
async def get_user_projects(user_id: str):
    """获取用户参与的项目"""
    projects = await project_service.get_user_projects(user_id)
    return {"projects": projects}

@router.post("/{project_id}/members")
async def add_member(project_id: str, req: MemberAdd):
    """添加项目成员"""
    await project_service.add_member(project_id, req.user_id, req.role)
    return {"success": True}

@router.delete("/{project_id}/members/{user_id}")
async def remove_member(project_id: str, user_id: str):
    """移除项目成员"""
    await project_service.remove_member(project_id, user_id)
    return {"success": True}

@router.get("/{project_id}/members")
async def get_members(project_id: str):
    """获取项目成员"""
    members = await project_service.get_members(project_id)
    return {"members": members}

@router.put("/{project_id}/progress")
async def update_progress(project_id: str, progress: float):
    """更新项目进度"""
    project = await project_service.update_progress(project_id, progress)
    return project

@router.put("/{project_id}/status")
async def update_status(project_id: str, status: str):
    """更新项目状态"""
    project = await project_service.update_status(project_id, status)
    return project
