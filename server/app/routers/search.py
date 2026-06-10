"""灵境平台 - 搜索路由 (语义+关键词+RRF混合搜索)"""
import json
import logging
from fastapi import APIRouter, Query
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
import embedding

logger = logging.getLogger("lingjing.search")

router = APIRouter(prefix="/api/v1", tags=["search"])


def _rrf_fuse(vec_results: list, kw_results: list, k: int = 60) -> list:
    scores = {}
    items = {}
    for rank, r in enumerate(vec_results):
        rid = r["memory_id"]
        scores[rid] = scores.get(rid, 0) + 1.0 / (k + rank + 1)
        items[rid] = r
    for rank, r in enumerate(kw_results):
        rid = r["memory_id"]
        scores[rid] = scores.get(rid, 0) + 1.0 / (k + rank + 1)
        items[rid] = r
    for rid in items:
        items[rid]["score"] = round(scores.get(rid, 0), 6)
    return sorted(items.values(), key=lambda x: x.get("score", 0), reverse=True)


def _row_to_dict(r, score=None):
    d = {
        "memory_id": r["memory_id"],
        "partner_id": r["partner_id"],
        "content": r["content"],
        "type": r["type"],
        "source": r["source"],
        "round": r["round"],
        "priority": r["priority"],
        "tags": list(r["tags"]) if r["tags"] else [],
        "metadata": json.loads(r["metadata"]) if isinstance(r["metadata"], str) else (r["metadata"] or {}),
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        "score": round(float(score), 4) if score is not None else None,
    }
    return d


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    mode: str = Query("hybrid", pattern="^(semantic|keyword|hybrid)$"),
    partner_id: str | None = None,
    type: str | None = None,
    source: str | None = None,
    limit: int = Query(10, le=50),
):
    filters = []
    params_base = []
    idx = 1

    if partner_id:
        filters.append(f"partner_id=${idx}")
        params_base.append(partner_id)
        idx += 1
    if type:
        filters.append(f"type=${idx}")
        params_base.append(type)
        idx += 1
    if source:
        filters.append(f"source=${idx}")
        params_base.append(source)
        idx += 1

    filter_clause = (" AND " + " AND ".join(filters)) if filters else ""
    fetch_limit = min(limit * 3, 60)

    vec_results = []
    kw_results = []

    async with database.pool.acquire() as conn:
        from pgvector.asyncpg import register_vector
        await register_vector(conn)

        if mode in ("semantic", "hybrid"):
            try:
                emb = await embedding.get_embedding(q)
                vec_sql = f"""SELECT memory_id, partner_id, content, type, source, round,
                    priority, tags, metadata, created_at,
                    embedding <=> ${idx}::vector AS distance
                FROM memories
                WHERE embedding IS NOT NULL{filter_clause}
                ORDER BY embedding <=> ${idx}::vector
                LIMIT {fetch_limit}"""
                rows = await conn.fetch(vec_sql, *params_base, emb)
                vec_results = [_row_to_dict(r, 1.0 - float(r["distance"])) for r in rows]
            except Exception as e:
                logger.warning(f"向量搜索失败: {e}")
                pass

        if mode in ("keyword", "hybrid"):
            kw_param_idx = idx
            kw_sql = f"""SELECT memory_id, partner_id, content, type, source, round,
                priority, tags, metadata, created_at,
                similarity(content, ${kw_param_idx}) AS sim
            FROM memories
            WHERE (content % ${kw_param_idx} OR content ILIKE '%' || ${kw_param_idx} || '%'){filter_clause}
            ORDER BY sim DESC
            LIMIT {fetch_limit}"""
            try:
                rows = await conn.fetch(kw_sql, *params_base, q)
                kw_results = [_row_to_dict(r, float(r["sim"])) for r in rows]
            except Exception as e:
                logger.warning(f"关键词搜索失败: {e}")
                pass

    if mode == "hybrid" and vec_results and kw_results:
        data = _rrf_fuse(vec_results, kw_results)[:limit]
    elif mode == "semantic":
        data = vec_results[:limit]
    elif mode == "keyword":
        data = kw_results[:limit]
    else:
        data = (vec_results or kw_results)[:limit]

    return {"code": 0, "query": q, "mode": mode, "total": len(data), "data": data}
