"""灵境 - 微信群聊消息管理路由

支持核心功能：
- 导入微信导出文件（TXT）
- 群聊管理
- AI分析归类
- 消息归类/关联项目
- 数据看板

权限设计：
  owner/project_manager: 导入、分析、归类、关联项目
  成员/技术员: 查看群聊/消息/分析结果
  工人: 无权限
"""
import os
import json
import uuid
import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Body

from .auth import get_current_user
from services.wechat_service import (
    parse_wechat_export, ensure_group, save_messages_batch,
    list_groups, get_group_detail, list_messages,
    get_dashboard_stats, update_message_category,
    link_message_to_project, batch_link_messages,
    parse_ocr_text, parse_raw_text,
)
from services.wechat_analysis import (
    analyze_group_messages, save_analysis_result, get_latest_analysis,
)
import db as database

logger = logging.getLogger("lingjing.wechat_router")
router = APIRouter(prefix="/api/v1/wechat", tags=["wechat"])

TMP_DIR = "/tmp/lingjing_imports"
os.makedirs(TMP_DIR, exist_ok=True)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# ---------------------------------------------------------------
# 权限辅助函数
# ---------------------------------------------------------------

def _check_tenant_access(user: dict, tenant_id: str):
    if not tenant_id:
        raise HTTPException(400, "缺少 tenant_id")
    if user.get("tenant_id") and user["tenant_id"] != tenant_id:
        raise HTTPException(403, "无权操作该租户的数据")

ALLOWED_WECHAT_ROLES = ("owner", "project_manager")

def _require_wechat_access(user: dict):
    """微信聊天管理仅限租户管理员(owner)和项目经理(project_manager)使用"""
    role = user.get("tenant_role") or ""
    if role not in ALLOWED_WECHAT_ROLES:
        raise HTTPException(403, "仅租户管理员和项目经理可使用微信聊天管理功能")

# ---------------------------------------------------------------
# 1. 导入微信导出文件
# ---------------------------------------------------------------

@router.post("/import")
async def import_wechat_file(
    file: UploadFile = File(...),
    tenant_id: str = Form(...),
    group_name: str = Form(""),
    user: dict = Depends(get_current_user),
):
    """上传微信导出的TXT聊天记录，自动解析并存储"""
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)

    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".txt", ".html", ".htm"):
        raise HTTPException(400, f"不支持的文件类型: {ext}，仅支持 .txt / .html")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, f"文件过大（{len(content)//1024//1024}MB），上限50MB")
    if len(content) == 0:
        raise HTTPException(400, "文件为空")

    # 保存临时文件
    tmp_id = uuid.uuid4().hex[:12]
    tmp_path = os.path.join(TMP_DIR, f"wechat_{tmp_id}{ext}")
    with open(tmp_path, "wb") as f:
        f.write(content)

    try:
        # 解析
        if ext == ".txt":
            parsed = parse_wechat_export(tmp_path, filename)
        else:
            # HTML暂用原解析，后续可增强
            from services.import_service import parse_wechat_html
            html_parsed = parse_wechat_html(tmp_path)
            parsed = {
                "group_name": group_name or "微信聊天",
                "messages": [
                    {"sender": m["sender"], "time": m["time"],
                     "content": m["content"],
                     "msg_id": uuid.uuid4().hex[:32],
                     "msg_time_iso": m.get("time", "")}
                    for m in html_parsed.get("messages", [])
                ],
                "members": [c["name"] for c in html_parsed.get("contacts", [])],
                "total_messages": html_parsed.get("total_messages", 0),
                "total_members": html_parsed.get("total_contacts", 0),
            }

        if parsed["total_messages"] == 0:
            return {
                "status": "failed", "error": "未能从文件中解析出有效的聊天记录",
                "group_id": None, "group_name": parsed["group_name"],
                "total_messages": 0, "inserted": 0,
            }

        # 如果用户指定了群名，覆盖自动识别的
        if group_name:
            parsed["group_name"] = group_name

        # 写入数据库
        async with database.pool.acquire() as conn:
            group_id = await ensure_group(conn, tenant_id, parsed["group_name"], parsed["total_members"])
            save_result = await save_messages_batch(conn, group_id, tenant_id, parsed["messages"])

        return {
            "status": "completed",
            "group_id": group_id,
            "group_name": parsed["group_name"],
            "total_messages": parsed["total_messages"],
            "total_members": parsed["total_members"],
            "inserted": save_result["inserted"],
            "skipped": save_result["skipped"],
        }
    except Exception as e:
        logger.error(f"微信文件解析失败: {e}")
        return {
            "status": "failed", "error": f"解析失败: {str(e)}",
            "group_id": None, "group_name": "",
            "total_messages": 0, "inserted": 0,
        }
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


# ---------------------------------------------------------------
# 1b. 截图导入 — 上传截图，moondream OCR识别后存储
# ---------------------------------------------------------------

@router.post("/import-screenshot")
async def import_wechat_screenshot(
    files: list[UploadFile] = File(...),
    tenant_id: str = Form(...),
    group_name: str = Form(""),
    user: dict = Depends(get_current_user),
):
    """上传微信聊天截图，moondream OCR识别文字后自动存储"""
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    if not files:
        raise HTTPException(400, "至少需要一张截图")
    if len(files) > 9:
        raise HTTPException(400, "最多9张截图")

    from services.file_service import _describe_image
    import uuid as _uuid

    all_ocr_texts = []
    saved_paths = []

    try:
        for file in files:
            ext = os.path.splitext(file.filename or "screenshot.png")[1].lower()
            if ext not in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
                raise HTTPException(400, f"不支持的图片格式: {ext}")

            tmp_id = _uuid.uuid4().hex[:12]
            tmp_path = os.path.join(TMP_DIR, f"screenshot_{tmp_id}{ext}")
            content = await file.read()
            if len(content) > 20 * 1024 * 1024:
                raise HTTPException(413, f"图片过大 ({len(content)//1024//1024}MB)，上限20MB")
            with open(tmp_path, "wb") as f:
                f.write(content)
            saved_paths.append(tmp_path)

            # 调用moondream OCR识别文字（prompt专注于提取微信聊天文字）
            ocr_result = await _describe_image(tmp_path)
            if ocr_result and "[图片分析" not in ocr_result and len(ocr_result) > 10:
                all_ocr_texts.append(ocr_result)

        if not all_ocr_texts:
            return {"status": "failed", "error": "未能从截图中识别出有效文字，请确认截图清晰包含聊天内容",
                    "group_id": None, "group_name": group_name or "截图聊天",
                    "total_messages": 0, "inserted": 0}

        combined = "\n---截图分隔---\n".join(all_ocr_texts)
        messages = await parse_ocr_text(combined)

        if not messages:
            return {"status": "failed", "error": "OCR识别成功但未能解析为结构化消息",
                    "group_id": None, "group_name": group_name or "截图聊天",
                    "total_messages": 0, "inserted": 0}

        final_group_name = group_name or f"截图聊天_{_uuid.uuid4().hex[:6]}"
        async with database.pool.acquire() as conn:
            gid = await ensure_group(conn, tenant_id, final_group_name, 0)
            save_result = await save_messages_batch(conn, gid, tenant_id, messages)

        logger.info(f"截图导入成功: {len(messages)}条消息 → {final_group_name}")
        return {
            "status": "completed",
            "group_id": gid,
            "group_name": final_group_name,
            "total_messages": len(messages),
            "inserted": save_result["inserted"],
            "skipped": save_result["skipped"],
            "ocr_preview": combined[:200] + "..." if len(combined) > 200 else combined,
        }
    except Exception as e:
        logger.error(f"截图导入失败: {e}")
        return {"status": "failed", "error": f"截图处理失败: {str(e)}",
                "group_id": None, "group_name": group_name or "截图聊天",
                "total_messages": 0, "inserted": 0}
    finally:
        for p in saved_paths:
            try:
                os.remove(p)
            except OSError:
                pass


# ---------------------------------------------------------------
# 1c. 文本粘贴导入 — 用户复制的微信聊天内容直接导入
# ---------------------------------------------------------------

@router.post("/import-text")
async def import_wechat_text(
    body: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """用户粘贴的微信聊天文本，自动解析并存储"""
    tenant_id = body.get("tenant_id", "")
    text = body.get("text", "")
    group_name = body.get("group_name", "")
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    if not text or len(text.strip()) < 5:
        raise HTTPException(400, "聊天文本内容太少")

    parsed = await parse_raw_text(text, group_name or "粘贴的聊天")
    if parsed["total_messages"] == 0:
        return {"status": "failed", "error": "未能解析出有效的聊天消息",
                "group_id": None, "group_name": parsed["group_name"],
                "total_messages": 0, "inserted": 0}

    if group_name:
        parsed["group_name"] = group_name

    async with database.pool.acquire() as conn:
        gid = await ensure_group(conn, tenant_id, parsed["group_name"], parsed["total_members"])
        save_result = await save_messages_batch(conn, gid, tenant_id, parsed["messages"])

    logger.info(f"文本导入成功: {parsed['total_messages']}条消息 → {parsed['group_name']}")
    return {
        "status": "completed",
        "group_id": gid,
        "group_name": parsed["group_name"],
        "total_messages": parsed["total_messages"],
        "inserted": save_result["inserted"],
        "skipped": save_result["skipped"],
    }


# ---------------------------------------------------------------
# 2. 群聊列表
# ---------------------------------------------------------------

@router.get("/groups")
async def get_groups(
    tenant_id: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    async with database.pool.acquire() as conn:
        return await list_groups(conn, tenant_id, page, page_size)


# ---------------------------------------------------------------
# 3. 群聊详情
# ---------------------------------------------------------------

@router.get("/groups/{group_id}")
async def get_group(
    group_id: str,
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    async with database.pool.acquire() as conn:
        group = await get_group_detail(conn, group_id, tenant_id)
        if not group:
            raise HTTPException(404, "群聊不存在")
        return group


# ---------------------------------------------------------------
# 4. 群聊消息列表
# ---------------------------------------------------------------

@router.get("/groups/{group_id}/messages")
async def get_messages(
    group_id: str,
    tenant_id: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    category: str = Query(""),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    async with database.pool.acquire() as conn:
        return await list_messages(conn, group_id, tenant_id, page, page_size, category)


# ---------------------------------------------------------------
# 5. 获取分析结果
# ---------------------------------------------------------------

@router.get("/groups/{group_id}/analysis")
async def get_analysis(
    group_id: str,
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    async with database.pool.acquire() as conn:
        analysis = await get_latest_analysis(conn, group_id)
        if not analysis:
            return {"status": "no_analysis", "message": "该群聊尚未进行AI分析"}
        return analysis


# ---------------------------------------------------------------
# 6. 触发AI分析
# ---------------------------------------------------------------

@router.post("/groups/{group_id}/analyze")
async def trigger_analysis(
    group_id: str,
    tenant_id: str = Form(...),
    date_from: str = Form(""),
    date_to: str = Form(""),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)

    async with database.pool.acquire() as conn:
        group = await get_group_detail(conn, group_id, tenant_id)
        if not group:
            raise HTTPException(404, "群聊不存在")

        # 获取消息
        msg_result = await list_messages(conn, group_id, tenant_id, page=1, page_size=500)
        messages = msg_result.get("messages", [])

        if not messages:
            return {"status": "failed", "message": "没有消息可供分析"}

    # AI分析
    analysis = await analyze_group_messages(group_id, messages)

    # 存储结果
    async with database.pool.acquire() as conn:
        analysis_id = await save_analysis_result(
            conn, group_id, tenant_id, analysis, date_from, date_to
        )

        # 更新消息的归类
        msg_cats = analysis.get("message_categories", {})
        for i, cat in msg_cats.items():
            if i < len(messages):
                msg_db_id = messages[i].get("id")
                if msg_db_id:
                    await update_message_category(conn, msg_db_id, tenant_id, cat)

    return {
        "status": "completed",
        "analysis_id": analysis_id,
        "summary": analysis.get("summary", ""),
        "categories": analysis.get("categories", {}),
        "tags": analysis.get("tags", []),
        "key_mentions": analysis.get("key_mentions", []),
        "suggested_projects": analysis.get("suggested_projects", []),
    }


# ---------------------------------------------------------------
# 7. 手动修改消息归类
# ---------------------------------------------------------------

@router.put("/messages/{msg_id}/category")
async def update_category(
    msg_id: int,
    data: dict = Body(...),
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    category = data.get("category", "unclassified")
    tags = data.get("tags", [])

    async with database.pool.acquire() as conn:
        ok = await update_message_category(conn, msg_id, tenant_id, category, tags)
        if not ok:
            raise HTTPException(404, "消息不存在或无权修改")
    return {"status": "ok", "msg_id": msg_id, "category": category}


# ---------------------------------------------------------------
# 8. 关联消息到项目
# ---------------------------------------------------------------

@router.put("/messages/{msg_id}/link-project")
async def link_to_project(
    msg_id: int,
    data: dict = Body(...),
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    project_id = data.get("project_id")
    if not project_id:
        raise HTTPException(400, "缺少 project_id")

    async with database.pool.acquire() as conn:
        ok = await link_message_to_project(conn, msg_id, tenant_id, project_id)
        if not ok:
            raise HTTPException(404, "消息不存在或无权操作")
    return {"status": "ok", "msg_id": msg_id, "project_id": project_id}


# ---------------------------------------------------------------
# 9. 批量关联消息到项目
# ---------------------------------------------------------------

@router.post("/groups/{group_id}/batch-link")
async def batch_link(
    group_id: str,
    data: dict = Body(...),
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    msg_ids = data.get("msg_ids", [])
    project_id = data.get("project_id")
    if not msg_ids or not project_id:
        raise HTTPException(400, "缺少 msg_ids 或 project_id")

    async with database.pool.acquire() as conn:
        count = await batch_link_messages(conn, msg_ids, tenant_id, project_id)
    return {"status": "ok", "linked_count": count, "project_id": project_id}


# ---------------------------------------------------------------
# 10. 归类统计数据看板
# ---------------------------------------------------------------

@router.get("/dashboard")
async def dashboard(
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)
    async with database.pool.acquire() as conn:
        return await get_dashboard_stats(conn, tenant_id)
