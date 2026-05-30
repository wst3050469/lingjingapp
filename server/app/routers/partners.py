"""灵境平台 - AI伙伴管理路由"""
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

router = APIRouter(prefix="/api/v1/partners", tags=["partners"])


class PartnerIn(BaseModel):
    partner_id: str
    display_name: str
    role_in_lingjing: str = ""
    role_desc: str = ""
    api_base_url: str = ""
    api_model: str = ""
    api_max_tokens: int = 4096
    identity_data: dict = {}
    key_quotes: list = []
    commitments: list = []
    special_notes: str = ""


@router.post("", status_code=201)
async def upsert_partner(p: PartnerIn):
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO ai_partners
                (partner_id, display_name, role_in_lingjing, role_desc,
                 api_base_url, api_model, api_max_tokens,
                 identity_data, key_quotes, commitments, special_notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (partner_id) DO UPDATE SET
                display_name=EXCLUDED.display_name,
                role_in_lingjing=EXCLUDED.role_in_lingjing,
                role_desc=EXCLUDED.role_desc,
                api_base_url=EXCLUDED.api_base_url,
                api_model=EXCLUDED.api_model,
                api_max_tokens=EXCLUDED.api_max_tokens,
                identity_data=EXCLUDED.identity_data,
                key_quotes=EXCLUDED.key_quotes,
                commitments=EXCLUDED.commitments,
                special_notes=EXCLUDED.special_notes,
                updated_at=NOW()
            RETURNING id, (xmax = 0) AS inserted""",
            p.partner_id, p.display_name, p.role_in_lingjing, p.role_desc,
            p.api_base_url, p.api_model, p.api_max_tokens,
            json.dumps(p.identity_data, ensure_ascii=False),
            json.dumps(p.key_quotes, ensure_ascii=False),
            json.dumps(p.commitments, ensure_ascii=False),
            p.special_notes,
        )
    action = "created" if row["inserted"] else "updated"
    return {"code": 0, "partner_id": p.partner_id, "msg": action}


@router.get("")
async def list_partners():
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT partner_id, display_name, role_in_lingjing, role_desc,
                      status, created_at, updated_at
               FROM ai_partners ORDER BY id"""
        )
    return {"code": 0, "total": len(rows), "data": [dict(r) for r in rows]}


@router.get("/{partner_id}")
async def get_partner(partner_id: str):
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT partner_id, display_name, role_in_lingjing, role_desc,
                      identity_data, key_quotes, commitments, special_notes,
                      status, created_at, updated_at
               FROM ai_partners WHERE partner_id=$1""",
            partner_id,
        )
    if not row:
        raise HTTPException(404, f"Partner {partner_id} not found")
    result = dict(row)
    for field in ("identity_data", "key_quotes", "commitments"):
        if isinstance(result[field], str):
            result[field] = json.loads(result[field])
    return {"code": 0, "data": result}


@router.get("/{partner_id}/memories")
async def get_partner_memories(
    partner_id: str,
    type: str | None = None,
    source: str | None = None,
    limit: int = 50,
):
    conditions = ["partner_id=$1"]
    params = [partner_id]
    idx = 2
    if type:
        conditions.append(f"type=${idx}")
        params.append(type)
        idx += 1
    if source:
        conditions.append(f"source=${idx}")
        params.append(source)
        idx += 1
    where = " AND ".join(conditions)

    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            f"""SELECT memory_id, content, type, source, round, priority,
                       tags, metadata, hash, created_at
                FROM memories WHERE {where}
                ORDER BY created_at ASC LIMIT ${idx}""",
            *params, limit,
        )
    data = []
    for r in rows:
        d = dict(r)
        if isinstance(d["metadata"], str):
            d["metadata"] = json.loads(d["metadata"])
        d["tags"] = list(d["tags"]) if d["tags"] else []
        data.append(d)
    return {"code": 0, "partner_id": partner_id, "total": len(data), "data": data}
