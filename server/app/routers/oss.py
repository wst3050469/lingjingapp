"""灵境 - OSS 上传路由（STS 凭证 + 上传回调）"""
import asyncio
import uuid
import logging
import sys
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from .auth import get_current_user
from services.oss_service import generate_sts_token, generate_upload_filename, get_cdn_url
from services.file_service import (
    classify_file, process_oss_file,
)
import db as database
import config
from config import MAX_IMAGE_SIZE, MAX_DOC_SIZE, MAX_VIDEO_SIZE, MAX_DRAWING_SIZE

logger = logging.getLogger("lingjing.oss")
router = APIRouter(prefix="/api/v1/oss", tags=["oss"])


@router.get("/sts-token")
async def get_sts_token(user: dict = Depends(get_current_user)):
    """获取 OSS 直传凭证（APP 用此凭证直传文件到 OSS，绕过 SSH 隧道）"""
    result = generate_sts_token(user["code"])
    return {"code": 0, **result}


class OssCallback(BaseModel):
    """OSS 上传完成回调"""
    object_key: str          # OSS 对象 key，如 uploads/2026-04/u_liuhui/abc123.jpg
    filename: str            # 原始文件名
    session_id: str          # 聊天会话 ID
    file_size: Optional[int] = 0
    mime_type: Optional[str] = None


@router.post("/upload-callback")
async def upload_callback(req: OssCallback, user: dict = Depends(get_current_user)):
    """
    APP 直传 OSS 完成后回调后端。
    后端从 OSS/CDN 下载文件 → 生成缩略图/提取文本/AI分析 → 写入 DB → 返回 file_id。
    """
    object_key = req.object_key
    filename = req.filename
    session_id = req.session_id
    invite_code = user["code"]
    
    # 文件类型检查
    file_type = classify_file(filename)
    if not file_type:
        raise HTTPException(400, f"不支持的文件类型: {filename}")
    
    # 大小检查
    max_size = (
        MAX_VIDEO_SIZE if file_type == "video"
        else MAX_IMAGE_SIZE if file_type == "image"
        else MAX_DRAWING_SIZE if file_type == "drawing"
        else MAX_DOC_SIZE
    )
    if req.file_size > max_size:
        max_mb = max_size // (1024 * 1024)
        raise HTTPException(400, f"文件过大，限制 {max_mb}MB")
    
    # 生成 file_id
    import uuid
    file_id = f"f_{uuid.uuid4().hex[:16]}"
    
    # 写入 DB（status=uploaded，OSS key 记录在 stored_path）
    cdn_url = get_cdn_url(object_key)
    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO message_files
               (file_id, session_id, invite_code, original_name, stored_path,
                file_type, mime_type, file_size, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')""",
            file_id, session_id, invite_code, filename, object_key,
            file_type, req.mime_type, req.file_size,
        )
    
    # 异步后台处理（下载 + 缩略图 + AI分析）
    asyncio.create_task(process_oss_file(file_id, object_key, file_type))
    
    return {
        "code": 0,
        "file_id": file_id,
        "type": file_type,
        "name": filename,
        "size": req.file_size,
        "url": cdn_url,
        "status": "processing",
    }


class DownloadResult(BaseModel):
    """OSS 下载结果（前端获取文件 CDN URL）"""
    file_ids: list[str]


@router.post("/get-urls")
async def get_file_urls(req: DownloadResult, user: dict = Depends(get_current_user)):
    """批量获取文件的 CDN URL（带权限校验）"""
    if not req.file_ids:
        return {"code": 0, "files": []}
    
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT file_id, stored_path, file_type, original_name, file_size, status
               FROM message_files
               WHERE file_id = ANY($1) AND invite_code = $2""",
            req.file_ids, user["code"],
        )
    
    files = []
    for r in rows:
        oss_key = r["stored_path"]
        url = get_cdn_url(oss_key) if oss_key.startswith("uploads/") else oss_key
        files.append({
            "file_id": r["file_id"],
            "name": r["original_name"],
            "type": r["file_type"],
            "size": r["file_size"],
            "url": url,
            "status": r["status"],
        })
    
    return {"code": 0, "files": files}


# ── 后端中转上传（接收 multipart → 上传 OSS → 返回 CDN URL）──

@router.post("/upload-via-backend")
async def upload_via_backend(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """后端中转上传到 OSS（先存本地立即返回，OSS 上传后台执行）
    
    优化: 流式写入本地文件（避免整文件读入内存），大文档友好。
    """
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    file_type = classify_file(filename)
    
    if not file_type:
        raise HTTPException(400, f"不支持的文件类型: {ext}")
    
    max_size = (
        MAX_VIDEO_SIZE if file_type == "video"
        else MAX_IMAGE_SIZE if file_type == "image"
        else MAX_DRAWING_SIZE if file_type == "drawing"
        else MAX_DOC_SIZE
    )
    
    # ── 生成存储路径 ──
    object_key, _ = generate_upload_filename(user["code"], filename)
    cdn_url = get_cdn_url(object_key)
    
    # ── 流式写入本地文件（逐块读写，避免大文件整读内存） ──
    local_dir = os.path.join(config.UPLOAD_DIR, "_pending_oss")
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, os.path.basename(object_key))
    
    total_size = 0
    chunk_size = 256 * 1024  # 256KB
    try:
        with open(local_path, 'wb') as f:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                total_size += len(chunk)
                if total_size > max_size:
                    raise HTTPException(400, f"文件过大，限制 {max_size // (1024 * 1024)}MB")
    except HTTPException:
        # 清理已写入的部分
        try: os.remove(local_path)
        except OSError: pass
        raise
    
    # ── 写入 DB ──
    file_id = f"f_{uuid.uuid4().hex[:16]}"
    
    async with database.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO message_files
               (file_id, session_id, invite_code, original_name, stored_path,
                file_type, mime_type, file_size, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'local')""",
            file_id, session_id, user["code"], filename, object_key,
            file_type, file.content_type, total_size,
        )
    
    # ── 后台：OSS 上传 + 处理（不阻塞返回） ──
    asyncio.create_task(_background_oss_upload(local_path, object_key, file_id, file_type, file.content_type))
    
    return {
        "code": 0,
        "file_id": file_id,
        "type": file_type,
        "name": filename,
        "size": total_size,
        "url": f"https://www.spiritrealmz.com/api/v1/files/serve/{file_id}",
        "cdn_url": cdn_url,
        "status": "local",
    }


async def _background_oss_upload(local_path: str, object_key: str, file_id: str,
                                  file_type: str, content_type: str | None = None):
    """后台任务：上传到 OSS + 缩略图/AI分析"""
    try:
        # 上传到 OSS
        with open(local_path, 'rb') as f:
            oss_result = _upload_to_oss(f.read(), object_key, content_type)
        if not oss_result:
            logger.error(f"后台 OSS 上传失败: {file_id}")
            async with database.pool.acquire() as conn:
                await conn.execute(
                    "UPDATE message_files SET status='error' WHERE file_id=$1", file_id)
            return
        
        # 更新状态
        async with database.pool.acquire() as conn:
            await conn.execute(
                "UPDATE message_files SET status='processing' WHERE file_id=$1", file_id)
        
        # 异步处理（缩略图/AI分析）
        await process_oss_file(file_id, object_key, file_type)
        
        # 检查处理后状态: 如果 process_oss_file 已标记 error, 不覆盖
        async with database.pool.acquire() as conn:
            current = await conn.fetchval(
                "SELECT status FROM message_files WHERE file_id=$1", file_id)
        
        if current != "error":
            # 标记为 ready（后续 serve 端点会 302 到 CDN）
            async with database.pool.acquire() as conn:
                await conn.execute(
                    "UPDATE message_files SET status='ready' WHERE file_id=$1", file_id)
        
    except Exception as e:
        logger.error(f"后台 OSS 上传异常 {file_id}: {e}")
        try:
            async with database.pool.acquire() as conn:
                await conn.execute(
                    "UPDATE message_files SET status='error' WHERE file_id=$1", file_id)
        except Exception:
            logger.warning(f"OSS上传失败后更新message_files状态出错: file_id={file_id}", exc_info=True)
            pass
    finally:
        # 清理本地临时文件
        try:
            os.remove(local_path)
        except Exception:
            pass  # 清理临时文件，失败无所谓


def _upload_to_oss(content: bytes, object_key: str, content_type: str | None = None) -> str | None:
    """使用 oss2 SDK 上传文件到 OSS，返回 URL"""
    try:
        import oss2
        auth = oss2.Auth(config.OSS_ACCESS_KEY_ID, config.OSS_ACCESS_KEY_SECRET)
        bucket = oss2.Bucket(auth, config.OSS_ENDPOINT, config.OSS_BUCKET_NAME)
        
        headers = {}
        if content_type:
            headers['Content-Type'] = content_type
        
        result = bucket.put_object(object_key, content, headers=headers)
        if result.status == 200:
            # 设置为公共读（CDN 可回源）
            bucket.put_object_acl(object_key, oss2.OBJECT_ACL_PUBLIC_READ)
            logger.info(f"OSS 上传成功: {object_key} ({len(content)} bytes)")
            return get_cdn_url(object_key)
        else:
            logger.error(f"OSS 上传失败: {object_key} status={result.status}")
            return None
    except ImportError:
        logger.error("oss2 SDK 未安装，请运行: pip install oss2")
        return None
    except Exception as e:
        logger.error(f"OSS 上传异常: {object_key}: {e}")
        return None
