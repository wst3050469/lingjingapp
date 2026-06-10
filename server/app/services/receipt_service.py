"""灵境 — 单据智能识别与归档服务

对用户上传的图片进行 DeepSeek 视觉增强分析，识别单据类型、提取金额/供应商/材料，
自动关联到业务系统。支持发票识别并创建 invoice 记录。
"""
import json
import re
import hashlib
import logging
from typing import Optional

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
import db as database

logger = logging.getLogger("lingjing.receipt")

# 单据类型
RECEIPT_TYPES = {
    "invoice": "发票",
    "receipt": "收据",
    "delivery_order": "送货单",
    "purchase_order": "采购单",
    "contract": "合同",
    "other": "其他",
}

_RECEIPT_ANALYSIS_PROMPT = """你是一个财务单据分析助手。分析以下图片描述，判断是否是单据/票据类图片。

如果是票据类（发票/收据/送货单/采购单），提取以下结构化信息，只返回 JSON：
{
  "is_receipt": true,
  "receipt_type": "invoice/receipt/delivery_order/purchase_order/other",
  "amount": 数字（元），如无法识别填 null,
  "supplier": "供应商名称或商家名，无则填null",
  "material": "采购材料/物品描述，无则填null", 
  "date": "单据日期 YYYY-MM-DD，无则填null",
  "summary": "50字以内概述",
  "invoice_no": "发票号（如果是发票，尽量提取），无则填null",
  "tax_amount": 税额（数字，如果是发票），无则填null,
  "total_amount": 含税总金额（数字，如果是发票），无则填null,
  "title": "发票抬头公司名，无则填null",
  "customer_name": "购买方名称（销项发票），无则填null",
  "supplier_name": "销售方名称（进项发票），无则填null"
}

如果不是票据（普通照片/截图/人物等），返回：
{
  "is_receipt": false
}

只返回 JSON，不要任何其他文字。图片描述:"""


async def analyze_receipt(image_description: str, user_message: str = "") -> Optional[dict]:
    """用 DeepSeek 分析图片描述是否单据，提取结构化信息"""
    prompt = _RECEIPT_ANALYSIS_PROMPT + image_description[:2000]
    if user_message:
        prompt += f"\n\n用户说：{user_message[:300]}"

    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.DEEPSEEK_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 500,
                    "temperature": 0,
                },
            )
            if resp.status_code != 200:
                logger.warning(f"单据分析 API 失败: {resp.status_code}")
                return None

            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            # 去掉可能的 markdown 代码块包裹
            if content.startswith("```"):
                content = re.sub(r'^```\w*\n?', '', content)
                content = re.sub(r'\n?```$', '', content)

            result = json.loads(content)
            if result.get("is_receipt"):
                logger.info(f"单据识别: type={result.get('receipt_type')}, amount={result.get('amount')}, supplier={result.get('supplier')}")
            return result
    except json.JSONDecodeError as e:
        logger.warning(f"单据分析 JSON 解析失败: {e}, content={content[:200] if 'content' in dir() else 'N/A'}")
        return None
    except Exception as e:
        logger.warning(f"单据分析异常: {e}")
        return None


async def auto_archive_receipt(
    file_id: str,
    image_description: str,
    user_message: str,
    invite_code: str,
    session_id: str,
    tenant_id: Optional[str] = None,
    nickname: str = "",
) -> Optional[int]:
    """
    自动归档单据：分析 → 写 biz_finance + 关联 file_id。
    返回 finance_id 或 None（非单据图片）。
    """
    if not tenant_id:
        # 个人用户：也尝试识别，但不写 biz_finance
        result = await analyze_receipt(image_description, user_message)
        if result and result.get("is_receipt"):
            # 个人用户：写入记忆
            await _write_receipt_memory(
                invite_code, session_id, result, image_description, user_message
            )
        return None

    result = await analyze_receipt(image_description, user_message)
    if not result or not result.get("is_receipt"):
        return None

    # 提取数据
    amount = result.get("amount")
    supplier = result.get("supplier") or ""
    material = result.get("material") or ""
    receipt_type = result.get("receipt_type", "other")
    date_str = result.get("date")
    summary = result.get("summary", user_message[:80])

    # 金额转换
    amount_float = float(amount) if amount else 0.0

    # 类别推断
    category = "material"  # 默认材料采购
    if any(kw in (user_message + summary) for kw in ["运费", "运输", "物流", "车费", "油费"]):
        category = "transport"
    elif any(kw in (user_message + summary) for kw in ["工具", "设备", "维修"]):
        category = "equipment"
    elif any(kw in (user_message + summary) for kw in ["工资", "人工"]):
        category = "labor"
    elif any(kw in (user_message + summary) for kw in ["餐费", "餐饮", "吃饭"]):
        category = "meal"
    elif any(kw in (user_message + summary) for kw in ["办公", "文具"]):
        category = "office"

    # 写 biz_finance
    async with database.pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """INSERT INTO biz_finance
                   (tenant_id, type, category, amount, applicant_name, status,
                    reason, file_ids, supplier_name, material_desc, expense_date)
                   VALUES ($1, 'expense', $2, $3, $4, 'pending',
                           $5, $6, $7, $8, $9)
                   RETURNING id""",
                tenant_id, category, max(amount_float, 0.01), nickname,
                summary[:200],
                json.dumps([file_id], ensure_ascii=False),
                supplier[:200],
                material[:500],
                date_str if date_str else None,
            )
            finance_id = row["id"]
            logger.info(f"单据归档: finance_id={finance_id}, type={receipt_type}, amount={amount_float}, supplier={supplier}, file={file_id}")

            # 同时写记忆（供应商+材料关键事实，便于后续检索）
            await _write_receipt_memory(
                invite_code, session_id, result, image_description, user_message, tenant_id
            )
            return finance_id
        except Exception as e:
            logger.error(f"单据归档失败: {e}", exc_info=True)
            return None


async def _write_receipt_memory(
    invite_code: str,
    session_id: str,
    result: dict,
    image_description: str,
    user_message: str,
    tenant_id: Optional[str] = None,
):
    """将单据关键信息写入记忆库"""
    supplier = result.get("supplier") or ""
    material = result.get("material") or ""
    amount = result.get("amount")
    receipt_type_cn = RECEIPT_TYPES.get(result.get("receipt_type", ""), "单据")

    content_parts = []
    if supplier:
        content_parts.append(f"供应商：{supplier}")
    if material:
        content_parts.append(f"采购材料：{material}")
    if amount:
        content_parts.append(f"金额：¥{amount}")
    content_parts.append(f"类型：{receipt_type_cn}")

    content = f"用户上传了{receipt_type_cn}：{'；'.join(content_parts)}"
    if user_message:
        content += f"（用户说：{user_message[:60]}）"

    hash_val = hashlib.sha256(content.encode()[:200]).hexdigest()[:16]

    async with database.pool.acquire() as conn:
        try:
            await conn.execute(
                """INSERT INTO memories
                   (memory_id, partner_id, content, type, source, priority, hash, confidence, scope, tenant_id)
                   VALUES ($1, $2, $3, 'action', $4, 70, $5, 0.9, $6, $7)
                   ON CONFLICT DO NOTHING""",
                f"mem_{hash_val}", invite_code, content[:500],
                f"chat:{session_id}", hash_val,
                "team" if tenant_id else "personal",
                tenant_id,
            )
        except Exception:
            logger.warning("保存识别结果到记忆失败", exc_info=True)
            pass


async def auto_create_invoice_from_receipt(
    file_id: str,
    image_description: str,
    user_message: str,
    invite_code: str,
    session_id: str,
    tenant_id: Optional[str] = None,
    nickname: str = "",
) -> Optional[int]:
    """
    当单据识别结果为"发票"时，自动创建 invoice 记录。
    返回 invoice_id 或 None（非发票图片/无需创建）。
    """
    if not tenant_id:
        return None

    result = await analyze_receipt(image_description, user_message)
    if not result or not result.get("is_receipt"):
        return None
    if result.get("receipt_type") != "invoice":
        return None  # 非发票类型，不创建 invoice

    # 提取发票数据
    invoice_no = result.get("invoice_no") or f"SCAN-{int(__import__('time').time())}"
    title = result.get("title") or result.get("supplier") or result.get("customer_name") or ""
    amount = result.get("amount")
    tax_amount = result.get("tax_amount")
    total_amount = result.get("total_amount")
    supplier_name = result.get("supplier_name") or result.get("supplier") or ""
    customer_name = result.get("customer_name") or ""
    date_str = result.get("date")

    if not title and not amount:
        logger.info(f"发票扫描缺必要字段: title={title}, amount={amount}")
        return None

    amount_f = float(amount) if amount else 0.0
    tax_f = float(tax_amount) if tax_amount else 0.0
    total_f = float(total_amount) if total_amount else (amount_f + tax_f)

    # 类别推断
    category = "材料款"
    keywords = (user_message + (result.get("summary") or "")).lower()
    if any(kw in keywords for kw in ["工程", "施工", "劳务", "人工"]):
        category = "工程款"
    elif any(kw in keywords for kw in ["服务", "咨询", "设计"]):
        category = "服务费"
    elif any(kw in keywords for kw in ["运输", "物流", "运费"]):
        category = "运输费"
    elif any(kw in keywords for kw in ["办公", "文具"]):
        category = "办公费"

    # 判断发票类型
    invoice_type = "purchase"
    if any(kw in keywords for kw in ["销项", "开票", "开给"]):
        invoice_type = "sales"

    async with database.pool.acquire() as conn:
        try:
            # 去重：同一发票号不重复创建
            if invoice_no and not invoice_no.startswith("SCAN-"):
                existing = await conn.fetchval(
                    "SELECT id FROM invoices WHERE tenant_id=$1 AND invoice_no=$2",
                    tenant_id, invoice_no,
                )
                if existing:
                    logger.info(f"发票已存在，跳过: invoice_no={invoice_no}, id={existing}")
                    return existing

            row = await conn.fetchrow(
                """INSERT INTO invoices
                   (tenant_id, invoice_no, invoice_type, title,
                    customer_name, supplier_name,
                    amount, tax_amount, total_amount,
                    invoice_category, payment_status, status,
                    invoice_date, file_ids, remarks,
                    created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'issued',
                           $12, $13, $14, NOW(), NOW())
                   RETURNING id""",
                tenant_id,
                invoice_no,
                invoice_type,
                title[:300],
                customer_name[:200],
                supplier_name[:200],
                max(amount_f, 0.01),
                max(tax_f, 0),
                max(total_f, 0.01),
                category,
                "unpaid",
                date_str if date_str else None,
                json.dumps([file_id], ensure_ascii=False),
                f"通过拍照扫描自动录入 by {nickname}",
            )
            invoice_id = row["id"]
            logger.info(f"发票扫描自动创建: invoice_id={invoice_id}, no={invoice_no}, title={title}, amount={total_f}")

            # 写记忆
            await _write_receipt_memory(
                invite_code, session_id, result, image_description, user_message, tenant_id
            )
            return invoice_id
        except Exception as e:
            logger.error(f"发票扫描创建失败: {e}", exc_info=True)
            return None
