"""灵境 — 样品管理服务（录入引导 + 模糊搜索 + 发工厂）"""
import json
import re
import logging

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database

logger = logging.getLogger("lingjing.sample")

# ── 配方推荐模板（地坪行业） ──
FORMULA_TEMPLATES = {
    "水磨石面层": {
        "白水泥": {"amount": 500, "unit": "g"},
        "石英砂(80-120目)": {"amount": 1200, "unit": "g"},
        "颜料": {"amount": 15, "unit": "g"},
        "减水剂": {"amount": 5, "unit": "g"},
        "水": {"amount": 180, "unit": "ml"},
    },
    "无机磨石基层": {
        "水泥": {"amount": 600, "unit": "g"},
        "骨料(5-8mm)": {"amount": 2000, "unit": "g"},
        "减水剂": {"amount": 8, "unit": "g"},
        "水": {"amount": 160, "unit": "ml"},
    },
    "环氧磨石面层": {
        "环氧树脂A": {"amount": 300, "unit": "g"},
        "固化剂B": {"amount": 150, "unit": "g"},
        "骨料(3-5mm)": {"amount": 1200, "unit": "g"},
        "色浆": {"amount": 10, "unit": "g"},
    },
}

STAGE_GUIDE = [
    {"field": "customer_name", "question": "这个样板是给哪个客户打的？", "hint": "请告诉我客户名称"},
    {"field": "shipping_address", "question": "客户的收货地址是什么？", "hint": "请告诉我收货地址（城市+详细地址）"},
    {"field": "project_name", "question": "关联哪个项目？", "hint": "请告诉我项目名称，没有可以跳过"},
    {"field": "specification", "question": "样板规格是多少？（如 200x200x20mm）", "hint": "请告诉我样板尺寸规格"},
    {"field": "recipe_name", "question": "用的什么配方？（如 K800面层、环氧磨石面层）", "hint": "请告诉我配方名称"},
    {"field": "formula", "question": "配方具体配比是什么？", "hint": "例如：白水泥500g、石英砂1200g、颜料15g。可以用配方模板「水磨石面层」"},
    {"field": "photo", "question": "请上传打好样板的照片", "hint": "请拍照或从相册上传样板照片"},
]

STATUS_CN = {
    "drafted": "草稿",
    "guide_customer": "待填客户",
    "guide_address": "待填地址",
    "guide_spec": "待填规格",
    "guide_formula": "待填配方",
    "guide_photo": "待传照片",
    "completed": "已完成",
    "sent_to_factory": "已发工厂",
    "in_production": "工厂生产中",
    "produced": "已生产",
}


async def create_sample(tenant_id: str, user_name: str) -> dict:
    """创建一个空白样品记录，返回 sample_id"""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO sample_records (tenant_id, created_by, status, notes)
               VALUES ($1, $2, 'guide_customer', $3) RETURNING id""",
            tenant_id, user_name, json.dumps({"step": 0}, ensure_ascii=False),
        )
    return {"sample_id": row["id"], "status": "guide_customer"}


async def get_draft_sample(tenant_id: str, user_name: str) -> dict | None:
    """获取当前用户未完成的样品草稿"""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT id, customer_name, shipping_address, specification,
                      image_url, image_file_id, file_ids, status, notes,
                      project_id, recipe_id, formula, city
               FROM sample_records
               WHERE tenant_id=$1 AND created_by=$2 AND status NOT IN ('completed','sent_to_factory','in_production','produced')
               ORDER BY updated_at DESC LIMIT 1""",
            tenant_id, user_name,
        )
    if not row:
        return None
    return _row_to_dict(row)


async def update_sample_field(tenant_id: str, sample_id: int, field: str, value: any) -> dict:
    """更新样品字段并推进步骤"""
    valid_fields = ["customer_name", "shipping_address", "specification", "project_name", "recipe_name", "notes"]
    if field not in valid_fields:
        return {"ok": False, "hint": f"未知字段: {field}"}

    async with database.pool.acquire() as conn:
        await conn.execute(
            f"UPDATE sample_records SET {field}=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3",
            str(value)[:500], sample_id, tenant_id,
        )

    # 检查是否需要推进状态
    new_status = await _determine_status(tenant_id, sample_id)
    return {"ok": True, "field": field, "status": new_status}


async def complete_sample(tenant_id: str, sample_id: int, file_ids: list[str] | None = None) -> dict:
    """样品完成（上传照片后）"""
    async with database.pool.acquire() as conn:
        sample = await conn.fetchrow(
            "SELECT * FROM sample_records WHERE id=$1 AND tenant_id=$2", sample_id, tenant_id,
        )
        if not sample:
            return {"ok": False, "hint": "样品不存在"}

        updates = ["status='completed'", "updated_at=NOW()"]
        params = [sample_id]
        if file_ids and len(file_ids) > 0:
            existing = json.loads(sample["file_ids"]) if isinstance(sample["file_ids"], str) else (sample["file_ids"] or [])
            all_ids = existing + file_ids
            updates.append(f"file_ids=${len(params) + 1}")
            params.append(json.dumps(all_ids, ensure_ascii=False))

        await conn.execute(f"UPDATE sample_records SET {', '.join(updates)} WHERE id=$1", *params)

    return {"ok": True, "sample_id": sample_id, "customer": sample["customer_name"], "status": "completed"}


async def send_to_factory(tenant_id: str, sample_id: int, user_name: str) -> dict:
    """样品发送工厂"""
    async with database.pool.acquire() as conn:
        sample = await conn.fetchrow(
            """SELECT s.*, r.name as recipe_name, r.ingredients, r.steps
               FROM sample_records s LEFT JOIN recipes r ON r.id = s.recipe_id
               WHERE s.id=$1 AND s.tenant_id=$2""",
            sample_id, tenant_id,
        )
        if not sample:
            return {"ok": False, "hint": "样品不存在"}

        if sample["status"] != "completed":
            return {"ok": False, "hint": f"样品当前状态为{STATUS_CN.get(sample['status'], sample['status'])}，只有已完成的样品才能发送工厂"}

        # 组装工厂通知信息
        formula = json.loads(sample["formula"]) if isinstance(sample["formula"], str) else (sample["formula"] or {})
        specs = {
            "sample_id": sample_id,
            "customer": sample["customer_name"],
            "address": sample["shipping_address"],
            "city": sample["city"],
            "specification": sample["specification"],
            "recipe_name": sample["recipe_name"] or (sample["recipe_name"] if sample.get("recipe_name") else "未指定"),
            "formula": formula,
            "file_ids": json.loads(sample["file_ids"] or "[]") if isinstance(sample["file_ids"], str) else (sample["file_ids"] or []),
            "notes": sample["notes"],
        }

        await conn.execute(
            "UPDATE sample_records SET status='sent_to_factory', factory_sent_at=NOW(), updated_at=NOW() WHERE id=$1",
            sample_id,
        )

        # 创建待办：工厂需要处理
        await conn.execute(
            """INSERT INTO todo_items (tenant_id, type, title, detail, ref_type, ref_id, priority, status)
               VALUES ($1, 'factory_production', $2, $3, 'sample', $4, 90, 'pending')""",
            tenant_id,
            f"样品 #{sample_id} 已发工厂，客户:{sample['customer_name']}，配方:{sample.get('recipe_name') or '未指定'}",
            json.dumps(specs, ensure_ascii=False),
            sample_id,
        )

        logger.info(f"样品发送工厂: sample_id={sample_id}, customer={sample['customer_name']}, recipe={sample.get('recipe_name')}")

    return {"ok": True, "sample_id": sample_id, "specs": specs}


async def fuzzy_search(tenant_id: str, query: str) -> list[dict]:
    """模糊搜索样品：按客户名/城市/项目/配方/日期/规格
    
    增强：鲁棒处理语音转录错误（如"调出"→"余下"）和中文/阿拉伯数字混用
    """
    async with database.pool.acquire() as conn:
        conditions = ["tenant_id=$1"]
        params: list = [tenant_id]
        has_id_match = False  # 是否通过精确ID匹配

        # ── 预处理：修正常见语音转录错误 ──
        _voice_fixes = {
            "余下": "调出",   # "调出3号" 常被 whisper 误识别为 "余下三号"
            "条目": "调出",
            "掉出": "调出",
            "调粗": "调出",
        }
        fixed_query = query
        for wrong, correct in _voice_fixes.items():
            if wrong in fixed_query:
                fixed_query = fixed_query.replace(wrong, correct)

        logger.info(f"fuzzy_search: query='{query}' -> fixed='{fixed_query}'")

        # ── 匹配样板ID ──
        # 方案1: 显式标记 (#100, 编号5, 样品3, ID:8)
        m = re.search(r'(?:#|编号|样品|ID[：:\s]*)\s*(\d{1,6})\b', fixed_query)
        if not m:
            # 方案2: "三号样板" / "3号样板" — 中文或阿拉伯数字在"号"前
            _cn_digit_map = {'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10',
                           '零':'0','两':'2'}
            m2 = re.search(r'([\d一二三四五六七八九十]{1,3})\s*号\s*(?:样板|样品|样板间)?', fixed_query)
            if m2:
                num_str = m2.group(1)
                if num_str.isdigit():
                    sample_id = int(num_str)
                else:
                    sample_id = int(_cn_digit_map.get(num_str, '0'))
                if sample_id and sample_id > 0:
                    conditions.append(f"id = ${len(params)+1}")
                    params.append(sample_id)
                    has_id_match = True
        else:
            sample_id = int(m.group(1))
            conditions.append(f"id = ${len(params)+1}")
            params.append(sample_id)
            has_id_match = True

        # 日期：哪天/哪月
        date_match = re.search(r'(\d{1,2})月(\d{1,2})[日号]?', fixed_query)
        if date_match:
            m, d = date_match.group(1), date_match.group(2)
            conditions.append(f"EXTRACT(MONTH FROM created_at)={int(m)} AND EXTRACT(DAY FROM created_at)={int(d)}")
        elif re.search(r'今天|今天打|今天.样', fixed_query):
            conditions.append("created_at::date = CURRENT_DATE")
        elif re.search(r'昨天', fixed_query):
            conditions.append("created_at::date = CURRENT_DATE - 1")

        # 关键词匹配 — 先清洗再分词
        clean = re.sub(r'(?:帮我|调出|查看|查询|查一下|看看|找|给我看|给我看看|把|的样板|样板|样品|样本|记录|有哪些|哪个|什么|一下|现在|这个|那个|你)', '', fixed_query)
        keywords = [w.strip() for w in re.findall(r'[\u4e00-\u9fffA-Za-z0-9._-]+', clean) if len(w.strip()) >= 1]
        _cn_num = {'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10'}
        expanded = list(keywords)
        for kw in keywords:
            for cn, num in _cn_num.items():
                if cn in kw:
                    expanded.append(kw.replace(cn, num))
        # 额外：从含中文数字的关键词中提取纯数字部分
        for kw in keywords:
            nums_in_kw = re.findall(r'[一二三四五六七八九十]+', kw)
            for cn_block in nums_in_kw:
                for cn, num in _cn_num.items():
                    if cn in cn_block:
                        expanded.append(num)
        # 同时也提取阿拉伯数字块
        for kw in keywords:
            for m3 in re.finditer(r'\d+', kw):
                val = m3.group()
                if val not in expanded:
                    expanded.append(val)
        keywords = list(set(expanded))[:8]
        
        # "所有/全部/都" → 返回全部，不加关键词筛选
        _ALL_WORDS = {"所有", "全部", "都", "所有的", "全部的"}
        if any(kw in _ALL_WORDS for kw in keywords):
            keywords = []
        if keywords:
            kw_conds = []
            for kw in keywords[:5]:
                kw_conds.append(f"(customer_name ILIKE '%' || ${len(params)+1} || '%' OR city ILIKE '%' || ${len(params)+1} || '%' OR recipe_name ILIKE '%' || ${len(params)+1} || '%' OR specification ILIKE '%' || ${len(params)+1} || '%' OR notes ILIKE '%' || ${len(params)+1} || '%')")
                params.append(kw)
            conditions.append("(" + " OR ".join(kw_conds) + ")")

        where = " AND ".join(conditions)
        rows = await conn.fetch(
            f"""SELECT * FROM sample_records WHERE {where} ORDER BY created_at DESC LIMIT 30""",
            *params,
        )

    results = []
    for r in rows:
        results.append(_row_to_dict(r))

    logger.info(f"fuzzy_search: primary results={len(results)}, has_id_match={has_id_match}, keywords={keywords[:5] if keywords else []}")

    # 如果精确ID匹配无结果，回退到仅关键词搜索（因为"3号"可能是用户命名而非数据库ID）
    if not results and has_id_match and keywords:
        async with database.pool.acquire() as conn2:
            # 去掉 id 条件，仅保留 tenant_id + 关键词
            simple_conds = ["tenant_id=$1"]
            simple_params: list = [tenant_id]
            if keywords:
                kw_conds = []
                for kw in keywords[:5]:
                    kw_conds.append(f"(customer_name ILIKE '%' || ${len(simple_params)+1} || '%' OR city ILIKE '%' || ${len(simple_params)+1} || '%' OR recipe_name ILIKE '%' || ${len(simple_params)+1} || '%' OR specification ILIKE '%' || ${len(simple_params)+1} || '%' OR notes ILIKE '%' || ${len(simple_params)+1} || '%')")
                    simple_params.append(kw)
                simple_conds.append("(" + " OR ".join(kw_conds) + ")")
            rows2 = await conn2.fetch(
                f"""SELECT * FROM sample_records WHERE {' AND '.join(simple_conds)} ORDER BY created_at DESC LIMIT 30""",
                *simple_params,
            )
            for r in rows2:
                results.append(_row_to_dict(r))

    if not results and keywords:
        # 后端：全文搜索 — 用最简数字（去除非数字噪音词）
        simple_kws = [k for k in keywords if len(k) <= 4 and re.search(r'\d', k)]
        if not simple_kws:
            simple_kws = keywords[:3]
        async with database.pool.acquire() as conn3:
            like_query = f"%{'%'.join(simple_kws[:3])}%"
            rows3 = await conn3.fetch(
                """SELECT * FROM sample_records WHERE tenant_id=$1
                   AND (customer_name ILIKE $2 OR city ILIKE $2 OR notes ILIKE $2)
                   ORDER BY created_at DESC LIMIT 20""",
                tenant_id, like_query,
            )
            for r in rows3:
                results.append(_row_to_dict(r))

    return results


def _row_to_dict(row) -> dict:
    formula = row.get("formula")
    if isinstance(formula, str):
        try: formula = json.loads(formula)
        except (json.JSONDecodeError, TypeError): formula = {}
    file_ids = row.get("file_ids")
    if isinstance(file_ids, str):
        try: file_ids = json.loads(file_ids)
        except (json.JSONDecodeError, TypeError): file_ids = []
    return {
        "id": row["id"],
        "customer_name": row.get("customer_name", ""),
        "shipping_address": row.get("shipping_address", ""),
        "city": row.get("city", ""),
        "specification": row.get("specification", ""),
        "recipe_name": row.get("recipe_name", ""),
        "recipe_id": str(row.get("recipe_id", "")) if row.get("recipe_id") else "",
        "project_name": row.get("project_name", ""),
        "project_id": row.get("project_id"),
        "formula": formula,
        "file_ids": file_ids or [],
        "image_url": row.get("image_url", ""),
        "image_file_id": row.get("image_file_id", ""),
        "status": row.get("status", ""),
        "notes": row.get("notes", ""),
        "factory_notes": row.get("factory_notes", ""),
        "created_by": row.get("created_by", ""),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else "",
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else "",
        "factory_sent_at": row["factory_sent_at"].isoformat() if row.get("factory_sent_at") else None,
        "phase": row.get("phase", ""),
        "is_signed": row.get("is_signed"),
    }


async def _determine_status(tenant_id: str, sample_id: int) -> str:
    """根据已填字段判断当前状态"""
    async with database.pool.acquire() as conn:
        r = await conn.fetchrow("SELECT * FROM sample_records WHERE id=$1", sample_id)
    if not r: return "drafted"
    if not r.get("customer_name"): return "guide_customer"
    if not r.get("shipping_address"): return "guide_address"
    if not r.get("specification"): return "guide_spec"
    if not r.get("recipe_name") and not r.get("formula"): return "guide_formula"
    return "guide_photo"
