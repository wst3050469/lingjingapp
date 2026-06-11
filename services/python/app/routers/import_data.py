"""灵境 - 外部数据导入路由

支持导入来源：
- POST /import/wechat-file  — 微信聊天记录导出文件（TXT/HTML）
- POST /import/sms          — 手机短信批量导入
- POST /import/contacts     — 手机通讯录批量导入
- GET  /import/records      — 导入记录查询
- DELETE /import/records/{id} — 删除导入记录（级联清理）
"""
import os
import json
import logging
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query

from .auth import get_current_user
from services.import_service import (
    parse_wechat_txt,
    parse_wechat_html,
    parse_sms_batch,
    parse_contacts_batch,
    dedup_contacts,
)
import db as database

logger = logging.getLogger("lingjing.import")
router = APIRouter(prefix="/api/v1/import", tags=["import"])


async def _check_admin_role(user: dict):
    """检查用户是否为租户管理员"""
    tenant_role = user.get("tenant_role") or ""
    if tenant_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="需要管理员权限（owner/admin）才能导入数据")
    return user

# 临时上传目录（微信导出文件）
TMP_IMPORT_DIR = "/tmp/lingjing_imports"
os.makedirs(TMP_IMPORT_DIR, exist_ok=True)

MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/wechat-file")
async def import_wechat_file(
    file: UploadFile = File(...),
    tenant_id: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """上传微信导出的聊天记录文件（TXT/HTML），自动解析提取联系人"""
    # 权限检查：需管理员角色
    await _check_admin_role(user)
    if not tenant_id:
        raise HTTPException(400, "缺少 tenant_id")
    if user.get("tenant_id") and user["tenant_id"] != tenant_id:
        raise HTTPException(403, "无权操作该租户的数据")

    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in (".txt", ".html", ".htm"):
        raise HTTPException(400, f"不支持的文件类型: {ext}，仅支持 .txt / .html")

    # 读取文件
    content = await file.read()
    if len(content) > MAX_IMPORT_FILE_SIZE:
        raise HTTPException(413, f"文件过大（{len(content)//1024//1024}MB），上限50MB")
    if len(content) == 0:
        raise HTTPException(400, "文件为空")

    # 保存临时文件
    tmp_id = uuid.uuid4().hex[:12]
    tmp_path = os.path.join(TMP_IMPORT_DIR, f"wechat_{tmp_id}{ext}")
    with open(tmp_path, "wb") as f:
        f.write(content)

    try:
        # 解析
        if ext == ".txt":
            parsed = parse_wechat_txt(tmp_path)
        else:
            parsed = parse_wechat_html(tmp_path)

        total_messages = parsed["total_messages"]
        total_contacts = parsed["total_contacts"]

        if total_messages == 0 and total_contacts == 0:
            return {
                "record_id": None,
                "source_type": "wechat",
                "total": 0,
                "contacts": 0,
                "messages": 0,
                "status": "failed",
                "error": "未能从文件中解析出有效的聊天记录，请确认文件格式是否正确",
            }

        # 去重合并
        new_contacts, dup_contacts = await dedup_contacts(tenant_id, parsed["contacts"], database.pool)

        # 写入数据库
        async with database.pool.acquire() as conn:
            record = await conn.fetchrow(
                """INSERT INTO import_records
                   (tenant_id, user_id, source_type, file_type, file_id,
                    total_items, imported_items, skipped_items, status, stats)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9)
                   RETURNING id""",
                tenant_id,
                user["code"],
                "wechat",
                ext,
                "",
                total_messages + total_contacts,
                len(new_contacts) + total_messages,
                len(dup_contacts),
                json.dumps({
                    "messages": total_messages,
                    "contacts_found": total_contacts,
                    "contacts_new": len(new_contacts),
                    "contacts_duplicate": len(dup_contacts),
                }),
            )
            record_id = record["id"]

            # 写入联系人
            for c in new_contacts + dup_contacts:
                await conn.execute(
                    """INSERT INTO import_contacts
                       (tenant_id, import_record_id, name, phone, company, source,
                        raw_data, matched_customer_id, is_duplicate, status)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
                    tenant_id,
                    record_id,
                    c.get("name", ""),
                    c.get("phone", ""),
                    c.get("company", ""),
                    c.get("source", "wechat"),
                    json.dumps(c),
                    c.get("matched_customer_id"),
                    c.get("is_duplicate", False),
                    "matched" if c.get("matched_customer_id") else "new",
                )

        return {
            "record_id": record_id,
            "source_type": "wechat",
            "total": total_messages + total_contacts,
            "contacts": total_contacts,
            "messages": total_messages,
            "contacts_new": len(new_contacts),
            "contacts_duplicate": len(dup_contacts),
            "status": "completed",
        }

    except Exception as e:
        logger.error(f"微信文件解析失败: {e}")
        return {
            "record_id": None,
            "source_type": "wechat",
            "total": 0,
            "contacts": 0,
            "messages": 0,
            "status": "failed",
            "error": f"解析失败: {str(e)}",
        }
    finally:
        # 清理临时文件
        try:
            os.remove(tmp_path)
        except OSError:
            pass


@router.post("/sms")
async def import_sms(
    data: dict,
    user: dict = Depends(get_current_user),
):
    """批量导入手机短信

    请求格式:
        {"tenant_id": "t_xxx", "sms_list": [{"address":"...", "body":"...", "date":"..."}]}
    """
    await _check_admin_role(user)
    tenant_id = data.get("tenant_id", "")
    if not tenant_id:
        raise HTTPException(400, "缺少 tenant_id")
    if user.get("tenant_id") and user["tenant_id"] != tenant_id:
        raise HTTPException(403, "无权操作该租户的数据")

    sms_list = data.get("sms_list", [])
    if not sms_list:
        raise HTTPException(400, "sms_list 不能为空")
    if len(sms_list) > 500:
        sms_list = sms_list[:500]  # 限制单次500条

    parsed = parse_sms_batch(sms_list)
    new_contacts, dup_contacts = await dedup_contacts(tenant_id, parsed["contacts"], database.pool)

    async with database.pool.acquire() as conn:
        record = await conn.fetchrow(
            """INSERT INTO import_records
               (tenant_id, user_id, source_type, file_type,
                total_items, imported_items, skipped_items, status, stats)
               VALUES ($1,$2,$3,'json',$4,$5,$6,'completed',$7)
               RETURNING id""",
            tenant_id,
            user["code"],
            "sms",
            len(parsed["messages"]) + len(parsed["contacts"]),
            len(new_contacts) + len(parsed["messages"]),
            len(dup_contacts),
            json.dumps({
                "messages": len(parsed["messages"]),
                "contacts_found": len(parsed["contacts"]),
                "contacts_new": len(new_contacts),
                "contacts_duplicate": len(dup_contacts),
            }),
        )
        record_id = record["id"]

        for c in new_contacts + dup_contacts:
            await conn.execute(
                """INSERT INTO import_contacts
                   (tenant_id, import_record_id, name, phone, company, source,
                    raw_data, matched_customer_id, is_duplicate, status)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
                tenant_id, record_id,
                c.get("name", ""), c.get("phone", ""), c.get("company", ""),
                c.get("source", "sms"), json.dumps(c),
                c.get("matched_customer_id"), c.get("is_duplicate", False),
                "matched" if c.get("matched_customer_id") else "new",
            )

    return {
        "record_id": record_id,
        "source_type": "sms",
        "total": len(parsed["messages"]) + len(parsed["contacts"]),
        "contacts": len(parsed["contacts"]),
        "messages": len(parsed["messages"]),
        "contacts_new": len(new_contacts),
        "contacts_duplicate": len(dup_contacts),
        "status": "completed",
    }


@router.post("/contacts")
async def import_contacts(
    data: dict,
    user: dict = Depends(get_current_user),
):
    """批量导入手机通讯录

    请求格式:
        {"tenant_id": "t_xxx", "contacts": [{"name":"...", "phones":["..."], "company":"..."}]}
    """
    await _check_admin_role(user)
    tenant_id = data.get("tenant_id", "")
    if not tenant_id:
        raise HTTPException(400, "缺少 tenant_id")
    if user.get("tenant_id") and user["tenant_id"] != tenant_id:
        raise HTTPException(403, "无权操作该租户的数据")

    contacts = data.get("contacts", [])
    if not contacts:
        raise HTTPException(400, "contacts 不能为空")

    parsed = parse_contacts_batch(contacts)
    new_contacts, dup_contacts = await dedup_contacts(tenant_id, parsed["contacts"], database.pool)

    async with database.pool.acquire() as conn:
        record = await conn.fetchrow(
            """INSERT INTO import_records
               (tenant_id, user_id, source_type, file_type,
                total_items, imported_items, skipped_items, status, stats)
               VALUES ($1,$2,$3,'json',$4,$5,$6,'completed',$7)
               RETURNING id""",
            tenant_id,
            user["code"],
            "contacts",
            len(parsed["contacts"]),
            len(new_contacts),
            len(dup_contacts),
            json.dumps({
                "contacts_found": len(parsed["contacts"]),
                "contacts_new": len(new_contacts),
                "contacts_duplicate": len(dup_contacts),
            }),
        )
        record_id = record["id"]

        for c in new_contacts + dup_contacts:
            await conn.execute(
                """INSERT INTO import_contacts
                   (tenant_id, import_record_id, name, phone, company, source,
                    raw_data, matched_customer_id, is_duplicate, status)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
                tenant_id, record_id,
                c.get("name", ""), c.get("phone", ""), c.get("company", ""),
                c.get("source", "contacts"), json.dumps(c),
                c.get("matched_customer_id"), c.get("is_duplicate", False),
                "matched" if c.get("matched_customer_id") else "new",
            )

    return {
        "record_id": record_id,
        "source_type": "contacts",
        "total": len(parsed["contacts"]),
        "contacts": len(new_contacts),
        "contacts_duplicate": len(dup_contacts),
        "contacts_matched": sum(1 for c in new_contacts + dup_contacts if c.get("matched_customer_id")),
        "status": "completed",
    }


@router.get("/records")
async def get_import_records(
    tenant_id: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_type: str = Query(""),
    user: dict = Depends(get_current_user),
):
    """查询导入记录列表"""
    if not tenant_id:
        raise HTTPException(400, "缺少 tenant_id")
    if user.get("tenant_id") and user["tenant_id"] != tenant_id:
        raise HTTPException(403, "无权操作该租户的数据")

    offset = (page - 1) * page_size
    conditions = ["tenant_id=$1"]
    params = [tenant_id]
    param_idx = 2

    if source_type:
        conditions.append(f"source_type=${param_idx}")
        params.append(source_type)
        param_idx += 1

    where = " AND ".join(conditions)

    async with database.pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM import_records WHERE {where}", *params
        )
        rows = await conn.fetch(
            f"""SELECT id, source_type, file_type, total_items, imported_items,
                       skipped_items, status, error_log, stats, created_at
                FROM import_records
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT ${param_idx} OFFSET ${param_idx+1}""",
            *params, page_size, offset,
        )

    records = []
    for r in rows:
        records.append({
            "id": r["id"],
            "source_type": r["source_type"],
            "file_type": r["file_type"],
            "total_items": r["total_items"],
            "imported_items": r["imported_items"],
            "skipped_items": r["skipped_items"],
            "status": r["status"],
            "error_log": r["error_log"] or "",
            "stats": r["stats"] if isinstance(r["stats"], dict) else json.loads(r["stats"] or "{}"),
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
        })

    return {"records": records, "total": total, "page": page, "page_size": page_size}


@router.get("/records/{record_id}/contacts")
async def get_import_contacts(
    record_id: int,
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    """查询某次导入记录的联系人列表"""
    if not tenant_id:
        raise HTTPException(400, "缺少 tenant_id")
    if user.get("tenant_id") and user["tenant_id"] != tenant_id:
        raise HTTPException(403, "无权操作该租户的数据")

    async with database.pool.acquire() as conn:
        # 验证记录归属
        record = await conn.fetchrow(
            "SELECT id FROM import_records WHERE id=$1 AND tenant_id=$2",
            record_id, tenant_id,
        )
        if not record:
            raise HTTPException(404, "导入记录不存在")

        rows = await conn.fetch(
            """SELECT id, name, phone, company, source, is_duplicate,
                      matched_customer_id, status, created_at
               FROM import_contacts
               WHERE import_record_id=$1
               ORDER BY is_duplicate ASC, id ASC""",
            record_id,
        )

    contacts = []
    for r in rows:
        contacts.append({
            "id": r["id"],
            "name": r["name"],
            "phone": r["phone"],
            "company": r["company"],
            "source": r["source"],
            "is_duplicate": r["is_duplicate"],
            "matched_customer_id": r["matched_customer_id"],
            "status": r["status"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
        })

    return {"contacts": contacts, "total": len(contacts)}


@router.delete("/records/{record_id}")
async def delete_import_record(
    record_id: int,
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    """删除导入记录（级联清理关联的 import_contacts）"""
    await _check_admin_role(user)
    if not tenant_id:
        raise HTTPException(400, "缺少 tenant_id")
    if user.get("tenant_id") and user["tenant_id"] != tenant_id:
        raise HTTPException(403, "无权操作该租户的数据")

    async with database.pool.acquire() as conn:
        record = await conn.fetchrow(
            "SELECT id FROM import_records WHERE id=$1 AND tenant_id=$2",
            record_id, tenant_id,
        )
        if not record:
            raise HTTPException(404, "导入记录不存在")

        # 级联删除（ON DELETE CASCADE 自动清理 import_contacts）
        await conn.execute("DELETE FROM import_records WHERE id=$1", record_id)

    return {"status": "deleted", "record_id": record_id}
