"""灵境 - 自动化任务 API"""
import json
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/automation", tags=["automation"])


class CreateAutomationRequest(BaseModel):
    name: str
    description_nl: str = ""
    cron_expr: str
    task_type: str
    query_config: dict = {}
    target_roles: list[str] = ["owner", "admin"]


class ParseRequest(BaseModel):
    description: str


def _require_tenant_admin(user: dict):
    if not user.get("tenant_id"):
        raise HTTPException(status_code=403, detail="非企业用户")
    tenant_role = user.get("tenant_role") or ""
    if tenant_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="需要管理员权限（owner/admin）")
    return user


@router.post("/parse")
async def parse_natural_language(req: ParseRequest):
    """用AI解析自然语言任务描述"""
    from services.task_parser import parse_natural_language, manual_parse
    result = await parse_natural_language(req.description)
    if not result["success"]:
        result = manual_parse(req.description)
    return {"code": 0, "data": result}


@router.get("/tasks")
async def list_tasks(
    user: dict = Depends(get_current_user),
    tenant_id: Optional[str] = Query(None),
):
    """获取自动化任务列表"""
    admin = _require_tenant_admin(user)
    tid = tenant_id or admin["tenant_id"]
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT * FROM automated_tasks WHERE tenant_id = $1 ORDER BY created_at DESC""",
            tid,
        )
    return {
        "code": 0,
        "data": [
            {
                "id": r["id"], "tenant_id": r["tenant_id"], "name": r["name"],
                "description_nl": r["description_nl"], "cron_expr": r["cron_expr"],
                "task_type": r["task_type"], "query_config": r["query_config"],
                "target_roles": r["target_roles"], "is_enabled": r["is_enabled"],
                "last_run_at": r["last_run_at"].isoformat() if r["last_run_at"] else None,
                "next_run_at": r["next_run_at"].isoformat() if r["next_run_at"] else None,
                "created_by": r["created_by"], "execution_count": r["execution_count"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
            }
            for r in rows
        ],
    }


@router.post("/tasks")
async def create_task(req: CreateAutomationRequest, user: dict = Depends(get_current_user)):
    """创建自动化任务"""
    admin = _require_tenant_admin(user)
    tid = admin["tenant_id"]
    from services.automation_engine import get_next_run_time
    next_run = get_next_run_time(req.cron_expr)
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO automated_tasks (tenant_id, name, description_nl, cron_expr, task_type,
               query_config, target_roles, next_run_at, created_by)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
               RETURNING id""",
            tid, req.name, req.description_nl, req.cron_expr, req.task_type,
            json.dumps(req.query_config, ensure_ascii=False), req.target_roles, next_run, admin.get("nickname", ""),
        )
    return {"code": 0, "data": {"id": row["id"]}}


@router.put("/tasks/{task_id}")
async def update_task(task_id: int, req: CreateAutomationRequest, user: dict = Depends(get_current_user)):
    """更新自动化任务"""
    admin = _require_tenant_admin(user)
    tid = admin["tenant_id"]
    from services.automation_engine import get_next_run_time
    next_run = get_next_run_time(req.cron_expr)
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM automated_tasks WHERE id = $1 AND tenant_id = $2", task_id, tid,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="任务不存在")
        await conn.execute(
            """UPDATE automated_tasks SET name=$1, description_nl=$2, cron_expr=$3, task_type=$4,
               query_config=$5::jsonb, target_roles=$6, next_run_at=$7, updated_at=NOW()
               WHERE id=$8""",
            req.name, req.description_nl, req.cron_expr, req.task_type,
            json.dumps(req.query_config, ensure_ascii=False), req.target_roles, next_run, task_id,
        )
    return {"code": 0, "msg": "更新成功"}


@router.post("/tasks/{task_id}/toggle")
async def toggle_task(task_id: int, user: dict = Depends(get_current_user)):
    """启用/禁用任务"""
    admin = _require_tenant_admin(user)
    tid = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id, is_enabled FROM automated_tasks WHERE id = $1 AND tenant_id = $2", task_id, tid,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="任务不存在")
        new_state = not existing["is_enabled"]
        await conn.execute(
            "UPDATE automated_tasks SET is_enabled = $1, updated_at = NOW() WHERE id = $2",
            new_state, task_id,
        )
    return {"code": 0, "data": {"is_enabled": new_state}}


@router.post("/tasks/{task_id}/trigger")
async def trigger_task(task_id: int, user: dict = Depends(get_current_user)):
    """手动触发任务"""
    admin = _require_tenant_admin(user)
    tid = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM automated_tasks WHERE id = $1 AND tenant_id = $2", task_id, tid,
        )
        if not row:
            raise HTTPException(status_code=404, detail="任务不存在")
        from services.automation_engine import _execute_task
        result = await _execute_task(dict(row))
    return {"code": 0, "data": result}


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, user: dict = Depends(get_current_user)):
    """删除任务"""
    admin = _require_tenant_admin(user)
    tid = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM automated_tasks WHERE id = $1 AND tenant_id = $2", task_id, tid,
        )
    return {"code": 0, "msg": "已删除"}


@router.get("/tasks/{task_id}/logs")
async def get_task_logs(
    task_id: int,
    user: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
):
    """获取任务执行日志"""
    admin = _require_tenant_admin(user)
    tid = admin["tenant_id"]
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT * FROM automated_task_logs
               WHERE task_id = $1 AND tenant_id = $2
               ORDER BY executed_at DESC LIMIT $3""",
            task_id, tid, limit,
        )
    return {
        "code": 0,
        "data": [
            {
                "id": r["id"], "executed_at": r["executed_at"].isoformat() if r["executed_at"] else None,
                "status": r["status"], "report_text": r["report_text"],
                "error_message": r["error_message"], "duration_ms": r["duration_ms"],
            }
            for r in rows
        ],
    }
