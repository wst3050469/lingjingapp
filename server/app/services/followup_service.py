"""灵境 — 客户跟进 & 供应商交互记录服务"""
import logging

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

logger = logging.getLogger("lingjing.followup")


async def record_followup(
    tenant_id: str,
    customer_name: str,
    content: str,
    session_id: str = "",
    followup_type: str = "chat",
    created_by: str = "",
) -> int | None:
    """记录一条客户跟进，返回跟进记录ID"""
    async with database.pool.acquire() as conn:
        # 查找 customer_id
        cust = await conn.fetchrow(
            "SELECT id FROM biz_customers WHERE tenant_id=$1 AND name=$2",
            tenant_id, customer_name,
        )
        customer_id = cust["id"] if cust else None

        # 模糊匹配
        if not customer_id and len(customer_name) >= 2:
            cust = await conn.fetchrow(
                "SELECT id, name FROM biz_customers WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1",
                tenant_id, f"%{customer_name}%",
            )
            if cust:
                customer_id = cust["id"]
                customer_name = cust["name"]

        row = await conn.fetchrow(
            """INSERT INTO customer_followups (tenant_id, customer_id, customer_name, type, content, session_id, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
            tenant_id, customer_id, customer_name, followup_type, content[:2000], session_id, created_by,
        )
        return row["id"] if row else None


async def record_supplier_interaction(
    tenant_id: str,
    supplier_name: str,
    content: str,
    session_id: str = "",
    interaction_type: str = "chat",
    created_by: str = "",
) -> int | None:
    """记录一条供应商交互记录，返回记录ID"""
    async with database.pool.acquire() as conn:
        # 查找 supplier_id
        supp = await conn.fetchrow(
            "SELECT id FROM biz_suppliers WHERE tenant_id=$1 AND name=$2",
            tenant_id, supplier_name,
        )
        supplier_id = supp["id"] if supp else None

        # 模糊匹配
        if not supplier_id and len(supplier_name) >= 2:
            supp = await conn.fetchrow(
                "SELECT id, name FROM biz_suppliers WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1",
                tenant_id, f"%{supplier_name}%",
            )
            if supp:
                supplier_id = supp["id"]
                supplier_name = supp["name"]

        await _ensure_supplier_followups_table(conn)
        row = await conn.fetchrow(
            """INSERT INTO supplier_followups (tenant_id, supplier_id, supplier_name, type, content, session_id, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
            tenant_id, supplier_id, supplier_name, interaction_type, content[:2000], session_id, created_by,
        )
        return row["id"] if row else None


async def _ensure_supplier_followups_table(conn):
    """确保 supplier_followups 表存在"""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS supplier_followups (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(32) NOT NULL,
            supplier_id INTEGER,
            supplier_name VARCHAR(200),
            type VARCHAR(50) DEFAULT 'chat',
            content TEXT,
            session_id VARCHAR(100),
            created_by VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sf_tenant ON supplier_followups(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sf_supplier ON supplier_followups(supplier_id);
    """)


async def get_customer_detail(tenant_id: str, name: str) -> dict | None:
    """获取客户详情（基本信息 + 跟进记录）"""
    async with database.pool.acquire() as conn:
        # 精确匹配
        cust = await conn.fetchrow(
            """SELECT id, name, contact_person, phone, company, source, status, notes, created_at, updated_at
               FROM biz_customers WHERE tenant_id=$1 AND name=$2""",
            tenant_id, name,
        )
        if not cust:
            cust = await conn.fetchrow(
                """SELECT id, name, contact_person, phone, company, source, status, notes, created_at, updated_at
                   FROM biz_customers WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1""",
                tenant_id, f"%{name}%",
            )
        if not cust:
            return None

        followups = await conn.fetch(
            """SELECT type, content, created_at, created_by FROM customer_followups
               WHERE tenant_id=$1 AND customer_id=$2
               ORDER BY created_at DESC LIMIT 30""",
            tenant_id, cust["id"],
        )

        return {
            "id": cust["id"],
            "name": cust["name"],
            "contact_person": cust["contact_person"],
            "phone": cust["phone"],
            "company": cust["company"],
            "source": cust["source"],
            "status": cust["status"],
            "notes": cust["notes"],
            "created_at": cust["created_at"].isoformat(),
            "updated_at": cust["updated_at"].isoformat(),
            "followups": [
                {"type": f["type"], "content": f["content"][:200], "created_at": f["created_at"].isoformat(), "by": f["created_by"]}
                for f in followups
            ],
        }


async def auto_followup_on_chat(tenant_id: str, user_message: str, session_id: str, nickname: str = ""):
    """聊天中提到客户时自动记录跟进"""
    # 检测客户名：聊天内容中提到之前录入过的客户
    async with database.pool.acquire() as conn:
        customers = await conn.fetch(
            "SELECT name FROM biz_customers WHERE tenant_id=$1 AND LENGTH(name) >= 2",
            tenant_id,
        )

    for c in customers:
        name = c["name"]
        if name and len(name) >= 2 and name in user_message:
            await record_followup(
                tenant_id=tenant_id,
                customer_name=name,
                content=user_message[:500],
                session_id=session_id,
                created_by=nickname,
            )
            break  # 每轮只记录一个客户


async def get_supplier_detail(tenant_id: str, name: str) -> dict | None:
    """获取供应商详情（基本信息 + 交互记录）"""
    async with database.pool.acquire() as conn:
        supp = await conn.fetchrow(
            """SELECT id, name, contact_person, phone, material_type, business_type,
                      address, rating, status, notes, created_at, updated_at
               FROM biz_suppliers WHERE tenant_id=$1 AND name=$2""",
            tenant_id, name,
        )
        if not supp:
            supp = await conn.fetchrow(
                """SELECT id, name, contact_person, phone, material_type, business_type,
                          address, rating, status, notes, created_at, updated_at
                   FROM biz_suppliers WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1""",
                tenant_id, f"%{name}%",
            )
        if not supp:
            return None

        await _ensure_supplier_followups_table(conn)
        interactions = await conn.fetch(
            """SELECT type, content, created_at, created_by FROM supplier_followups
               WHERE tenant_id=$1 AND supplier_id=$2
               ORDER BY created_at DESC LIMIT 30""",
            tenant_id, supp["id"],
        )

        # 产品报价
        products = await conn.fetch(
            "SELECT product_name, spec, unit, unit_price, quoted_at FROM biz_supplier_products WHERE supplier_id=$1 ORDER BY quoted_at DESC",
            supp["id"],
        )

        return {
            "id": supp["id"],
            "name": supp["name"],
            "contact_person": supp["contact_person"],
            "phone": supp["phone"],
            "material_type": supp["material_type"],
            "business_type": supp["business_type"],
            "address": supp["address"],
            "rating": supp["rating"],
            "status": supp["status"],
            "notes": supp["notes"],
            "created_at": supp["created_at"].isoformat(),
            "updated_at": supp["updated_at"].isoformat(),
            "products": [
                {"product_name": p["product_name"], "spec": p["spec"], "unit": p["unit"],
                 "unit_price": float(p["unit_price"]) if p["unit_price"] else None,
                 "quoted_at": p["quoted_at"].isoformat() if p["quoted_at"] else None}
                for p in products
            ],
            "interactions": [
                {"type": f["type"], "content": f["content"][:200],
                 "created_at": f["created_at"].isoformat(), "by": f["created_by"]}
                for f in interactions
            ],
        }


async def auto_track_supplier_on_chat(tenant_id: str, user_message: str, session_id: str, nickname: str = ""):
    """聊天中提到供应商时自动记录交互"""
    async with database.pool.acquire() as conn:
        suppliers = await conn.fetch(
            "SELECT name FROM biz_suppliers WHERE tenant_id=$1 AND LENGTH(name) >= 2",
            tenant_id,
        )

    for s in suppliers:
        name = s["name"]
        if name and len(name) >= 2 and name in user_message:
            await record_supplier_interaction(
                tenant_id=tenant_id,
                supplier_name=name,
                content=user_message[:500],
                session_id=session_id,
                created_by=nickname,
            )
            break
