"""任务路由"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services import TaskService

router = APIRouter(prefix="/api/tasks", tags=["任务管理"])
task_service = TaskService()

class TaskCreate(BaseModel):
    tenant_id: str
    title: str
    project_id: Optional[str] = None
    assignee_id: Optional[str] = None
    creator_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = "normal"

@router.post("/")
async def create_task(req: TaskCreate):
    """创建任务"""
    result = await task_service.create_task(
        tenant_id=req.tenant_id,
        title=req.title,
        project_id=req.project_id,
        assignee_id=req.assignee_id,
        creator_id=req.creator_id,
        due_date=req.due_date,
        priority=req.priority,
    )
    return result

@router.get("/{task_id}")
async def get_task(task_id: str):
    """获取任务"""
    task = await task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task

@router.get("/")
async def list_tasks(tenant_id: str, assignee_id: Optional[str] = None,
                      project_id: Optional[str] = None, status: Optional[str] = None):
    """获取任务列表"""
    tasks = await task_service.list_tasks(tenant_id, assignee_id, project_id, status)
    return {"tasks": tasks, "total": len(tasks)}

@router.put("/{task_id}/assign")
async def assign_task(task_id: str, assignee_id: str):
    """指派任务"""
    task = await task_service.assign_task(task_id, assignee_id)
    return task

@router.put("/{task_id}/status")
async def update_task_status(task_id: str, status: str):
    """更新任务状态"""
    task = await task_service.update_status(task_id, status)
    return task

@router.put("/{task_id}/progress")
async def update_task_progress(task_id: str, progress: float):
    """更新任务进度"""
    task = await task_service.update_progress(task_id, progress)
    return task
