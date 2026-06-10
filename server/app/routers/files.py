"""灵境 - 文件上传路由"""
import asyncio
import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from .auth import get_current_user
from services.file_service import (
    save_upload, process_file, classify_file,
    ALLOWED_EXTENSIONS,
)
from services.oss_service import get_cdn_url
from app.config import MAX_IMAGE_SIZE, MAX_DOC_SIZE, MAX_VIDEO_SIZE, MAX_DRAWING_SIZE, UPLOAD_DIR
import db as database

logger = logging.getLogger("lingjing.files")
router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.get("/serve/{file_id}")
async def serve_file(file_id: str):
    """文件直出：本地文件优先 → OSS ready 后才转 CDN
    
    状态流转: local → processing → ready
    - local/processing: 本地文件直出（立即可显）
    - ready: 本地已删 → 302 跳 CDN
    """
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT file_id, stored_path, file_type, mime_type, status FROM message_files WHERE file_id=$1",
            file_id,
        )
    if not row:
        raise HTTPException(404, "文件不存在")
    
    # 优先本地文件（local 或 processing 状态）
    local_path = os.path.join(UPLOAD_DIR, "_pending_oss", os.path.basename(row['stored_path']))
    if os.path.exists(local_path):
        return FileResponse(local_path, media_type=row['mime_type'] or 'application/octet-stream')
    
    # 本地已删 → 跳 CDN（即使 processing 失败，OSS 上的文件是完整的）
    if row['status'] in ('ready', 'error'):
        cdn_url = get_cdn_url(row['stored_path'])
        return RedirectResponse(url=cdn_url, status_code=302)
    
    raise HTTPException(404, "文件尚未就绪，请稍后刷新")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """上传文件（图片/PDF/Word/Excel/视频）"""
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"不支持的文件类型: {ext}，支持: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    file_type = classify_file(filename)
    if file_type == "video":
        max_size = MAX_VIDEO_SIZE
    elif file_type == "image":
        max_size = MAX_IMAGE_SIZE
    elif file_type == "drawing":
        max_size = MAX_DRAWING_SIZE
    else:
        max_size = MAX_DOC_SIZE

    # 读取文件内容
    content = await file.read()
    if len(content) > max_size:
        max_mb = max_size // (1024 * 1024)
        raise HTTPException(400, f"文件过大，{file_type}类型限制{max_mb}MB")

    if len(content) == 0:
        raise HTTPException(400, "文件为空")

    result = await save_upload(
        file_bytes=content,
        filename=filename,
        session_id=session_id,
        invite_code=user["code"],
        mime_type=file.content_type,
    )

    # 后台处理（文本提取/图片分析/视频缩略图）
    asyncio.create_task(process_file(result["file_id"]))

    return {"code": 0, **result}
