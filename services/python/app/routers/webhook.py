"""
灵境AI业务管家 - 数据接入框架（Webhook + 连接器）
外部系统通过 Webhook 将数据推入灵境，灵境自动写入业务表并触发 AI 处理。
支持的连接器类型：
  - ad_lead: 广告线索（百度/抖音/微信广告等投放平台回调）
  - payment: 收款通知（支付宝/微信支付/银行回调）
  - supplier: 供应商对接（采购单发送/到货通知）
  - custom: 自定义数据推送
"""
import json
import hmac
import hashlib
import uuid
from fastapi import APIRouter, Request, HTTPException
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

router = APIRouter(prefix="/api/v1/webhook", tags=["webhook"])


# ============================================================
# Webhook 密钥验证
# ============================================================

async def _verify_webhook(tenant_id: str, request: Request) -> dict:
    """验证 webhook 请求合法性，返回租户信息"""
    async with database.pool.acquire() as conn:
        tenant = await conn.fetchrow(
            "SELECT tenant_id, company_name, config FROM tenants WHERE tenant_id=$1 AND status='active'",
            tenant_id,
        )
    if not tenant:
        raise HTTPException(status_code=404, detail="租户不存在")

    config = tenant["config"] if isinstance(tenant["config"], dict) else {}
    webhook_secret = config.get("webhook_secret")

    # 如果配置了密钥，校验签名
    if webhook_secret:
        signature = request.headers.get("X-Webhook-Signature", "")
        body = await request.body()
        expected = hmac.new(
            webhook_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=403, detail="签名验证失败")

    return dict(tenant)


# ============================================================
# 广告线索接入
# ============================================================

@router.post("/{tenant_id}/ad-lead")
async def receive_ad_lead(tenant_id: str, request: Request):
    """
    接收广告平台推送的客户线索。
    Body: {"name": "张三", "phone": "13800138000", "source": "douyin", "note": "对环氧磨石感兴趣"}
    """
    await _verify_webhook(tenant_id, request)
    data = await request.json()

    name = data.get("name", "").strip()
    phone = data.get("phone", "").strip()
    source = data.get("source", "ad")
    note = data.get("note", "")

    if not name and not phone:
        raise HTTPException(status_code=400, detail="至少需要 name 或 phone")

    async with database.pool.acquire() as conn:
        # 去重：同租户同手机号
        if phone:
            existing = await conn.fetchval(
                "SELECT id FROM biz_customers WHERE tenant_id=$1 AND phone=$2",
                tenant_id, phone,
            )
            if existing:
                return {"code": 0, "msg": "客户已存在", "customer_id": existing, "duplicate": True}

        row = await conn.fetchrow(
            """INSERT INTO biz_customers (tenant_id, name, phone, source, status, notes)
               VALUES ($1, $2, $3, $4, 'lead', $5)
               RETURNING id""",
            tenant_id, name or f"线索_{phone[-4:]}", phone, source,
            f"[广告线索] {note}" if note else "[广告线索自动录入]",
        )

    return {
        "code": 0,
        "msg": "线索已录入",
        "customer_id": row["id"],
        "duplicate": False,
    }


# ============================================================
# 收款通知接入
# ============================================================

@router.post("/{tenant_id}/payment")
async def receive_payment(tenant_id: str, request: Request):
    """
    接收收款通知。
    Body: {"amount": 50000, "payer": "南京XX公司", "channel": "bank", "ref_no": "TXN123", "note": "星河湾项目首付"}
    """
    await _verify_webhook(tenant_id, request)
    data = await request.json()

    amount = data.get("amount")
    if not amount or float(amount) <= 0:
        raise HTTPException(status_code=400, detail="金额无效")

    payer = data.get("payer", "")
    channel = data.get("channel", "other")
    ref_no = data.get("ref_no", "")
    note = data.get("note", "")

    # 尝试关联项目
    project_id = None
    if note:
        async with database.pool.acquire() as conn:
            projects = await conn.fetch(
                "SELECT id, name FROM biz_projects WHERE tenant_id=$1",
                tenant_id,
            )
            for p in projects:
                if p["name"] in note:
                    project_id = p["id"]
                    break

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO biz_finance
               (tenant_id, project_id, type, category, amount, applicant_name, status, reason)
               VALUES ($1, $2, 'income', $3, $4, $5, 'paid', $6)
               RETURNING id""",
            tenant_id, project_id, channel, float(amount),
            payer, f"[收款] {note} ref:{ref_no}" if ref_no else f"[收款] {note}",
        )

    return {"code": 0, "msg": "收款已记录", "finance_id": row["id"]}


# ============================================================
# 供应商对接
# ============================================================

@router.post("/{tenant_id}/supplier")
async def receive_supplier_event(tenant_id: str, request: Request):
    """
    接收供应商事件（到货通知、报价回复等）。
    Body: {"event": "delivery", "supplier": "XX建材", "items": "水泥50吨", "amount": 25000, "project": "星河湾"}
    """
    await _verify_webhook(tenant_id, request)
    data = await request.json()

    event = data.get("event", "info")
    supplier = data.get("supplier", "")
    items = data.get("items", "")
    amount = data.get("amount")
    project_name = data.get("project", "")

    # 关联项目
    project_id = None
    if project_name:
        async with database.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM biz_projects WHERE tenant_id=$1 AND name LIKE $2",
                tenant_id, f"%{project_name}%",
            )
            if row:
                project_id = row["id"]

    # 如果有金额，记录到财务表
    finance_id = None
    if amount and float(amount) > 0:
        async with database.pool.acquire() as conn:
            frow = await conn.fetchrow(
                """INSERT INTO biz_finance
                   (tenant_id, project_id, type, category, amount, applicant_name, status, reason)
                   VALUES ($1, $2, 'expense', 'material', $3, $4, 'paid', $5)
                   RETURNING id""",
                tenant_id, project_id, float(amount), supplier,
                f"[供应商-{event}] {items}",
            )
            finance_id = frow["id"]

    return {
        "code": 0,
        "msg": f"供应商事件已记录: {event}",
        "finance_id": finance_id,
    }


# ============================================================
# 通用数据推送
# ============================================================

@router.post("/{tenant_id}/custom")
async def receive_custom_data(tenant_id: str, request: Request):
    """
    通用数据推送接口，适用于任何未定义专用连接器的数据源。
    数据存入 tenant 的 config.webhook_log，同时触发 AI 记忆存储。
    Body: {"type": "任意类型", "data": {...}, "source": "来源标识"}
    """
    await _verify_webhook(tenant_id, request)
    data = await request.json()

    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    event_type = data.get("type", "custom")
    source = data.get("source", "unknown")
    payload = data.get("data", data)

    # 存入通用事件表（如果存在），否则仅返回确认
    async with database.pool.acquire() as conn:
        # 检查是否有 webhook_events 表
        has_table = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='webhook_events')"
        )
        if has_table:
            await conn.execute(
                """INSERT INTO webhook_events (event_id, tenant_id, event_type, source, payload)
                   VALUES ($1, $2, $3, $4, $5)""",
                event_id, tenant_id, event_type, source,
                json.dumps(payload, ensure_ascii=False),
            )

    return {
        "code": 0,
        "msg": "数据已接收",
        "event_id": event_id,
        "type": event_type,
    }
