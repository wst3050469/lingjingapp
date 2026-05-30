"""灵境 - 技术员角色API路由"""
import json
import uuid
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query, Form
from pydantic import BaseModel
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
from config import UPLOAD_DIR
from .auth import get_current_user

router = APIRouter(prefix="/api/v1/technician", tags=["technician"])


class RecipeCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    ingredients: List[dict] = []
    steps: List[dict] = []
    category: Optional[str] = None


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ingredients: Optional[List[dict]] = None
    steps: Optional[List[dict]] = None
    category: Optional[str] = None


async def _check_technician_permission(user: dict) -> dict:
    tenant_role = user.get("tenant_role") or "member"
    if tenant_role not in ("technician", "admin", "owner", "project_manager"):
        raise HTTPException(status_code=403, detail="只有技术员或管理员才能访问此接口")
    return user


@router.post("/recipes")
async def create_recipe(item: RecipeCreate, user: dict = Depends(get_current_user)):
    await _check_technician_permission(user)
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法创建配方")
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO recipes (tenant_id, name, description, ingredients, steps, category, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id, name, created_at""",
            tenant_id, item.name, item.description,
            json.dumps(item.ingredients, ensure_ascii=False),
            json.dumps(item.steps, ensure_ascii=False),
            item.category, user.get("user_id"),
        )
    return {"code": 0, "data": {"id": row["id"], "name": row["name"], "created_at": row["created_at"].isoformat()}, "msg": "配方已创建"}


@router.get("/recipes")
async def list_recipes(category: Optional[str] = None, limit: int = Query(50, le=200), offset: int = Query(0, ge=0), user: dict = Depends(get_current_user)):
    await _check_technician_permission(user)
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法查询配方")
    async with database.pool.acquire() as conn:
        if category:
            rows = await conn.fetch("""SELECT id, name, description, category, created_by, created_at FROM recipes WHERE tenant_id=$1 AND category=$2 AND status='active' ORDER BY created_at DESC LIMIT $3 OFFSET $4""", tenant_id, category, limit, offset)
        else:
            rows = await conn.fetch("""SELECT id, name, description, category, created_by, created_at FROM recipes WHERE tenant_id=$1 AND status='active' ORDER BY created_at DESC LIMIT $2 OFFSET $3""", tenant_id, limit, offset)
    return {"code": 0, "data": [{"id": r["id"], "name": r["name"], "description": r["description"], "category": r["category"], "created_by": r["created_by"], "created_at": r["created_at"].isoformat() if r["created_at"] else None} for r in rows], "total": len(rows)}


@router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, user: dict = Depends(get_current_user)):
    await _check_technician_permission(user)
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法查询配方")
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("""SELECT id, name, description, ingredients, steps, category, created_by, created_at FROM recipes WHERE id=$1 AND tenant_id=$2 AND status='active'""", recipe_id, tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="配方不存在")
    return {"code": 0, "data": {"id": row["id"], "name": row["name"], "description": row["description"], "ingredients": json.loads(row["ingredients"]) if row["ingredients"] else [], "steps": json.loads(row["steps"]) if row["steps"] else [], "category": row["category"], "created_by": row["created_by"], "created_at": row["created_at"].isoformat() if row["created_at"] else None}}


@router.put("/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, item: RecipeUpdate, user: dict = Depends(get_current_user)):
    await _check_technician_permission(user)
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法更新配方")
    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM recipes WHERE id=$1 AND tenant_id=$2 AND status='active'", recipe_id, tenant_id)
        if not existing:
            raise HTTPException(status_code=404, detail="配方不存在")
        name = item.name if item.name is not None else None
        description = item.description if item.description is not None else None
        ingredients = json.dumps(item.ingredients, ensure_ascii=False) if item.ingredients is not None else None
        steps = json.dumps(item.steps, ensure_ascii=False) if item.steps is not None else None
        category = item.category if item.category is not None else None
        await conn.execute("""UPDATE recipes SET name=COALESCE($1, name), description=COALESCE($2, description), ingredients=COALESCE($3, ingredients), steps=COALESCE($4, steps), category=COALESCE($5, category), updated_at=NOW() WHERE id=$6""", name, description, ingredients, steps, category, recipe_id)
    return {"code": 0, "msg": "配方已更新"}


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: dict = Depends(get_current_user)):
    await _check_technician_permission(user)
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法删除配方")
    async with database.pool.acquire() as conn:
        result = await conn.execute("UPDATE recipes SET status='deleted', updated_at=NOW() WHERE id=$1 AND tenant_id=$2", recipe_id, tenant_id)
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="配方不存在")
    return {"code": 0, "msg": "配方已删除"}


@router.post("/template-images/upload")
async def upload_template_image(file: UploadFile = File(...), name: str = Form(...), description: str = Form(""), category: str = Form(""), user: dict = Depends(get_current_user)):
    await _check_technician_permission(user)
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法上传图片")
    if not file.content_type or file.content_type.split("/")[0] != "image":
        raise HTTPException(status_code=400, detail="只支持图片文件")
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("""INSERT INTO template_images (tenant_id, name, description, image_url, category, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, image_url, created_at""", tenant_id, name, description, f"/uploads/{filename}", category, user.get("user_id"))
    return {"code": 0, "data": {"id": row["id"], "name": row["name"], "image_url": row["image_url"], "created_at": row["created_at"].isoformat()}, "msg": "图片已上传"}


@router.get("/template-images")
async def list_template_images(category: Optional[str] = None, limit: int = Query(50, le=200), offset: int = Query(0, ge=0), user: dict = Depends(get_current_user)):
    await _check_technician_permission(user)
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法查询图片")
    async with database.pool.acquire() as conn:
        if category:
            rows = await conn.fetch("""SELECT id, name, description, image_url, category, created_by, created_at FROM template_images WHERE tenant_id=$1 AND category=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4""", tenant_id, category, limit, offset)
        else:
            rows = await conn.fetch("""SELECT id, name, description, image_url, category, created_by, created_at FROM template_images WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3""", tenant_id, limit, offset)
    return {"code": 0, "data": [{"id": r["id"], "name": r["name"], "description": r["description"], "image_url": r["image_url"], "category": r["category"], "created_by": r["created_by"], "created_at": r["created_at"].isoformat() if r["created_at"] else None} for r in rows], "total": len(rows)}


@router.delete("/template-images/{image_id}")
async def delete_template_image(image_id: str, user: dict = Depends(get_current_user)):
    await _check_technician_permission(user)
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="非企业用户，无法删除图片")
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT image_url FROM template_images WHERE id=$1 AND tenant_id=$2", image_id, tenant_id)
        if not row:
            raise HTTPException(status_code=404, detail="样板图片不存在")
        image_url = row["image_url"]
        if image_url and image_url.startswith("/uploads/"):
            filepath = os.path.join(UPLOAD_DIR, image_url.split("/")[-1])
            if os.path.exists(filepath):
                os.remove(filepath)
        await conn.execute("DELETE FROM template_images WHERE id=$1 AND tenant_id=$2", image_id, tenant_id)
    return {"code": 0, "msg": "图片已删除"}
