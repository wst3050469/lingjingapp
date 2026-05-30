"""灵境平台 - 记忆存储路由 (增强: Markdown导出/编辑/透明化)"""
import hashlib
import json
import io
import re
import zipfile
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
import models
import embedding

logger = logging.getLogger("lingjing.memories")

router = APIRouter(prefix="/api/v1/memories", tags=["memories"])


def _hash_content(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def _memory_to_markdown(m: dict) -> str:
    """将单条记忆转换为 Markdown 格式"""
    created = m.get("created_at", "")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    metadata = m.get("metadata", {})
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except (json.JSONDecodeError, TypeError):
            metadata = {}
    
    lines = [
        f"# 记忆: {m.get('memory_id', 'unknown')}",
        "",
        f"- **类型**: {m.get('type', 'fact')}",
        f"- **来源**: {m.get('source', 'manual')}",
        f"- **优先级**: {m.get('priority', 1)}",
        f"- **创建时间**: {created}",
        f"- **完整性哈希**: `{m.get('hash', '')}`",
        "",
        "---",
        "",
        m.get("content", ""),
        "",
        "---",
    ]
    
    # provenance 信息
    if metadata.get("provenance"):
        lines.append("")
        lines.append("### 来源追踪")
        for prov in metadata["provenance"]:
            lines.append(f"- {prov}")
    
    # 标签
    tags = m.get("tags", [])
    if tags:
        lines.append("")
        lines.append(f"**标签**: {' '.join(f'`{t}`' for t in tags)}")
    
    return "\n".join(lines)


# ── 请求模型 ──

class EditContentIn(BaseModel):
    content: str
    reason: Optional[str] = None


class ImportMarkdownIn(BaseModel):
    partner_id: str
    content: str
    type: str = "fact"
    source: str = "imported"
    tenant_id: Optional[str] = None


@router.post("", status_code=201)
async def upsert_memory(mem: models.MemoryIn, sync_embedding: bool = Query(False)):
    emb = None
    if sync_embedding:
        try:
            emb = await embedding.get_embedding(mem.content)
        except Exception as e:
            import logging
            logging.getLogger("lingjing.memories").warning(f"单条embedding失败: {e}")
            pass

    content_hash = _hash_content(mem.content)

    async with database.pool.acquire() as conn:
        from pgvector.asyncpg import register_vector
        await register_vector(conn)
        row = await conn.fetchrow(
            """INSERT INTO memories
                (memory_id, partner_id, content, type, source, round,
                 priority, embedding, tags, metadata, hash)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (memory_id) DO UPDATE SET
                content=EXCLUDED.content, type=EXCLUDED.type,
                source=EXCLUDED.source, round=EXCLUDED.round,
                priority=EXCLUDED.priority,
                embedding=COALESCE(EXCLUDED.embedding, memories.embedding),
                tags=EXCLUDED.tags, metadata=EXCLUDED.metadata,
                hash=EXCLUDED.hash, updated_at=NOW()
            RETURNING id, (xmax = 0) AS inserted""",
            mem.memory_id, mem.partner_id, mem.content, mem.type,
            mem.source, str(mem.round), mem.priority, emb,
            mem.tags, json.dumps(mem.metadata, ensure_ascii=False),
            content_hash,
        )
    action = "created" if row["inserted"] else "updated"
    return {"code": 0, "memory_id": mem.memory_id, "hash": content_hash, "msg": action}


@router.post("/batch")
async def batch_upsert(memories: list[models.MemoryIn], sync_embedding: bool = Query(False)):
    inserted = updated = 0
    embeddings = [None] * len(memories)

    if sync_embedding and memories:
        try:
            embeddings = await embedding.get_embeddings_batch([m.content for m in memories])
        except Exception as e:
            import logging
            logging.getLogger("lingjing.memories").warning(f"批量embedding失败: {e}")
            pass

    async with database.pool.acquire() as conn:
        from pgvector.asyncpg import register_vector
        await register_vector(conn)
        for mem, emb in zip(memories, embeddings):
            content_hash = _hash_content(mem.content)
            row = await conn.fetchrow(
                """INSERT INTO memories
                    (memory_id, partner_id, content, type, source, round,
                     priority, embedding, tags, metadata, hash)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                ON CONFLICT (memory_id) DO UPDATE SET
                    content=EXCLUDED.content, type=EXCLUDED.type,
                    source=EXCLUDED.source, round=EXCLUDED.round,
                    priority=EXCLUDED.priority,
                    embedding=COALESCE(EXCLUDED.embedding, memories.embedding),
                    tags=EXCLUDED.tags, metadata=EXCLUDED.metadata,
                    hash=EXCLUDED.hash, updated_at=NOW()
                RETURNING (xmax = 0) AS inserted""",
                mem.memory_id, mem.partner_id, mem.content, mem.type,
                mem.source, str(mem.round), mem.priority, emb,
                mem.tags, json.dumps(mem.metadata, ensure_ascii=False),
                content_hash,
            )
            if row["inserted"]:
                inserted += 1
            else:
                updated += 1

    return {"code": 0, "inserted": inserted, "updated": updated, "total": inserted + updated}


@router.get("")
async def list_memories(
    partner_id: str | None = None,
    type: str | None = None,
    source: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    conditions = []
    params = []
    idx = 1
    if partner_id:
        conditions.append(f"partner_id=${idx}")
        params.append(partner_id)
        idx += 1
    if type:
        conditions.append(f"type=${idx}")
        params.append(type)
        idx += 1
    if source:
        conditions.append(f"source=${idx}")
        params.append(source)
        idx += 1
    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    async with database.pool.acquire() as conn:
        total = await conn.fetchval(f"SELECT count(*) FROM memories {where}", *params)
        rows = await conn.fetch(
            f"""SELECT memory_id, partner_id, content, type, source, round,
                       priority, tags, metadata, hash, created_at
                FROM memories {where}
                ORDER BY created_at ASC
                LIMIT ${idx} OFFSET ${idx+1}""",
            *params, limit, offset,
        )

    data = []
    for r in rows:
        d = dict(r)
        if isinstance(d["metadata"], str):
            d["metadata"] = json.loads(d["metadata"])
        d["tags"] = list(d["tags"]) if d["tags"] else []
        data.append(d)
    return {"code": 0, "total": total, "data": data}


@router.get("/export")
async def export_memories_markdown(
    partner_id: str | None = None,
    tenant_id: str | None = None,
    type: str | None = None,
    limit: int = Query(500, le=2000),
):
    """导出记忆为 Markdown ZIP 文件
    
    对标 OpenHuman Obsidian Wiki 导出：
    每条记忆是一个 .md 文件，按类型分目录。
    用户下载后用 Obsidian 或其他 Markdown 编辑器查看和编辑。
    """
    conditions = []
    params = []
    idx = 1
    if partner_id:
        conditions.append(f"partner_id=${idx}")
        params.append(partner_id)
        idx += 1
    if tenant_id:
        conditions.append(f"tenant_id=${idx}")
        params.append(tenant_id)
        idx += 1
    if type:
        conditions.append(f"type=${idx}")
        params.append(type)
        idx += 1
    # 排除系统记忆和做梦摘要
    conditions.append("type NOT IN ('system', 'dream_summary')")
    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            f"""SELECT memory_id, partner_id, tenant_id, content, type, source,
                       priority, tags, metadata, hash, created_at
                FROM memories {where}
                ORDER BY created_at DESC
                LIMIT ${idx}""",
            *params, limit,
        )

    # 构建 ZIP 文件
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.md", (
            "# 灵境记忆导出\n\n"
            f"导出时间: {datetime.now(timezone.utc).isoformat()}\n\n"
            f"共 {len(rows)} 条记忆\n\n"
            "## 目录结构\n\n"
            "- `facts/` — 事实类记忆（客户/供应商/项目）\n"
            "- `events/` — 事件类记忆\n"
            "- `preferences/` — 偏好类记忆\n"
            "- `chat_records/` — 对话记录\n"
            "- `imported/` — 导入的记忆\n"
            "- `other/` — 其他类型\n\n"
            "## 使用方法\n\n"
            "1. 用 Obsidian 或其他 Markdown 编辑器打开此文件夹\n"
            "2. 浏览和编辑 .md 文件\n"
            "3. 修改后的文件可通过『导入 Markdown』功能写回记忆库\n"
        ))

        type_dirs = {
            "fact": "facts", "opinion": "opinions",
            "preference": "preferences", "event": "events",
            "chat_record": "chat_records", "imported": "imported",
        }

        for r in rows:
            m = dict(r)
            md_content = _memory_to_markdown(m)
            mem_type = m.get("type", "other")
            subdir = type_dirs.get(mem_type, "other")
            safe_name = re.sub(r'[\\/:*?"<>|]', '_', m.get("memory_id", f"mem_{m.get('created_at', '')}"))
            filepath = f"{subdir}/{safe_name}.md"
            zf.writestr(filepath, md_content)

    zip_buffer.seek(0)
    filename = f"lingjing_memories_{datetime.now().strftime('%Y%m%d')}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{memory_id}/markdown")
async def get_memory_markdown(memory_id: str):
    """获取单条记忆的 Markdown 格式"""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT memory_id, partner_id, tenant_id, content, type, source,
                      priority, tags, metadata, hash, created_at
               FROM memories WHERE memory_id=$1""",
            memory_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="记忆不存在")
    
    md = _memory_to_markdown(dict(row))
    return PlainTextResponse(md, media_type="text/markdown")


@router.put("/{memory_id}/content")
async def edit_memory_content(memory_id: str, edit: EditContentIn):
    """编辑记忆内容
    
    对标 OpenHuman：用户可以在 Obsidian 中编辑 .md 文件，
    编辑后的内容写回记忆库，下次 AI 检索时使用新内容。
    """
    if not edit.content or len(edit.content.strip()) < 2:
        raise HTTPException(status_code=400, detail="内容不能为空")
    
    content_hash = _hash_content(edit.content)
    async with database.pool.acquire() as conn:
        # 检查记忆是否存在
        existing = await conn.fetchrow(
            "SELECT content FROM memories WHERE memory_id=$1", memory_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="记忆不存在")
        
        old_content = existing["content"]
        was_modified = old_content != edit.content
        
        # 更新内容 + metadata 追加编辑记录
        await conn.execute(
            """UPDATE memories
               SET content=$1, hash=$2, updated_at=NOW(),
                   metadata = jsonb_set(
                       COALESCE(metadata, '{}'::jsonb),
                       '{edit_history}',
                       COALESCE(
                           metadata->'edit_history',
                           '[]'::jsonb
                       ) || jsonb_build_array(
                           jsonb_build_object(
                               'at', NOW()::text,
                               'reason', $3,
                               'old_hash', $4
                           )
                       )
                   )
               WHERE memory_id=$5""",
            edit.content,
            content_hash,
            edit.reason or "用户编辑",
            _hash_content(old_content),
            memory_id,
        )
    
    action = "modified" if was_modified else "unchanged"
    logger.info(f"记忆编辑: {memory_id} ({action})")
    return {
        "code": 0,
        "memory_id": memory_id,
        "hash": content_hash,
        "action": action,
        "message": "记忆已更新" if was_modified else "内容未改变",
    }


@router.post("/import-markdown")
async def import_memory_markdown(mem: ImportMarkdownIn):
    """导入 Markdown 内容为记忆
    
    对标 OpenHuman：用户在 Obsidian 中写的笔记，
    通过导入引擎进入记忆库，AI 下次检索即能引用。
    """
    if not mem.content or len(mem.content.strip()) < 5:
        raise HTTPException(status_code=400, detail="内容至少5个字符")
    
    memory_id = f"imported_{hashlib.sha256(mem.content.encode()).hexdigest()[:12]}"
    content_hash = _hash_content(mem.content)
    
    async with database.pool.acquire() as conn:
        try:
            await conn.execute(
                """INSERT INTO memories
                    (memory_id, partner_id, content, type, source, priority,
                     hash, metadata)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT (memory_id) DO UPDATE SET
                    content=EXCLUDED.content,
                    type=EXCLUDED.type,
                    priority=EXCLUDED.priority,
                    hash=EXCLUDED.hash,
                    updated_at=NOW()""",
                memory_id,
                mem.partner_id,
                mem.content[:2000],
                mem.type,
                mem.source,
                50,  # 默认优先级
                content_hash,
                json.dumps({
                    "provenance": ["用户导入Markdown"],
                    "tenant_id": mem.tenant_id,
                }, ensure_ascii=False),
            )
        except Exception as e:
            logger.warning(f"导入记忆失败: {e}")
            raise HTTPException(status_code=500, detail=f"导入失败: {e}")
    
    return {
        "code": 0,
        "memory_id": memory_id,
        "hash": content_hash,
        "message": "记忆导入成功",
    }
