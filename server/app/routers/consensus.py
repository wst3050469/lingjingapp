"""灵境平台 - 共识账本路由"""
import hashlib
import json
from fastapi import APIRouter
from pydantic import BaseModel
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

router = APIRouter(prefix="/api/v1/consensus", tags=["consensus"])


class ConsensusIn(BaseModel):
    consensus_id: str
    debate_version: str = "1.0"
    topic: str
    vote_result: dict = {}
    consensus_text: str
    dissent_recorded: str = ""


def _compute_hash(content: str, prev_hash: str) -> str:
    return hashlib.sha256(f"{prev_hash}:{content}".encode()).hexdigest()[:16]


@router.post("", status_code=201)
async def add_consensus(c: ConsensusIn):
    async with database.pool.acquire() as conn:
        # 获取上一条共识的hash
        prev = await conn.fetchval(
            "SELECT hash FROM consensus_ledger ORDER BY id DESC LIMIT 1"
        )
        prev_hash = prev or "genesis"
        content_hash = _compute_hash(c.consensus_text, prev_hash)

        row = await conn.fetchrow(
            """INSERT INTO consensus_ledger
                (consensus_id, debate_version, topic, vote_result,
                 consensus_text, dissent_recorded, hash, prev_hash)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (consensus_id) DO NOTHING
            RETURNING id""",
            c.consensus_id, c.debate_version, c.topic,
            json.dumps(c.vote_result, ensure_ascii=False),
            c.consensus_text, c.dissent_recorded,
            content_hash, prev_hash,
        )
    if row:
        return {"code": 0, "consensus_id": c.consensus_id, "hash": content_hash, "msg": "recorded"}
    return {"code": 1, "msg": "already exists"}


@router.get("")
async def list_consensus():
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT consensus_id, debate_version, topic, vote_result,
                      consensus_text, dissent_recorded, hash, prev_hash, created_at
               FROM consensus_ledger ORDER BY id ASC"""
        )
    data = []
    for r in rows:
        d = dict(r)
        if isinstance(d["vote_result"], str):
            d["vote_result"] = json.loads(d["vote_result"])
        data.append(d)
    return {"code": 0, "total": len(data), "data": data}


@router.get("/verify")
async def verify_chain():
    """验证共识链完整性"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT consensus_id, consensus_text, hash, prev_hash FROM consensus_ledger ORDER BY id ASC"
        )
    if not rows:
        return {"code": 0, "valid": True, "msg": "empty chain"}

    broken = []
    for i, r in enumerate(rows):
        expected_prev = rows[i - 1]["hash"] if i > 0 else "genesis"
        if r["prev_hash"] != expected_prev:
            broken.append({
                "consensus_id": r["consensus_id"],
                "expected_prev": expected_prev,
                "actual_prev": r["prev_hash"],
            })
        expected_hash = _compute_hash(r["consensus_text"], r["prev_hash"])
        if r["hash"] != expected_hash:
            broken.append({
                "consensus_id": r["consensus_id"],
                "expected_hash": expected_hash,
                "actual_hash": r["hash"],
            })

    return {
        "code": 0,
        "valid": len(broken) == 0,
        "total_records": len(rows),
        "broken_links": broken,
    }
