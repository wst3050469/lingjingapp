"""灵境平台 - 自动记忆提炼服务 (多租户版 v2)

核心改进:
1. 白名单模式: 只提取符合显式模式的事实，AI推测直接丢弃
2. 置信度标记: user_stated=0.9 / pattern_matched=0.7 / deduced=0.3
3. 语义去重: 存入前用embedding查相似度，>0.92则UPDATE而非INSERT
4. 生命周期: 系统状态类记忆30天自动过期
5. 租户隔离: 通过tenant_id物理过滤
"""
import json
import uuid
import hashlib
import logging
import httpx
import re
from datetime import datetime, timedelta, timezone
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config, embedding
import db as database

logger = logging.getLogger("lingjing.memory_extractor")

# ============================================================
# 白名单模式: 显式事实提取正则
# ============================================================

_PHONE_RE = re.compile(r'1[3-9]\d{9}')

_SUPPLIER_RE = re.compile(
    r'([\u4e00-\u9fff（）()\u00b7]{3,20}?(?:有限公司|科技有限公司|建筑材料|建设工程|建材|矿产品|装饰|新材|高岭|公司|工厂|厂家))'
    r'.{0,10}(?:是|为)'
    r'.{0,30}(?:供应商|供货商|材料商|建材商|厂家)'
)

# 客户提取正则（与供应商对等）
_CUSTOMER_RE = re.compile(
    r'([\u4e00-\u9fff（）()\u00b7]{3,20}?(?:有限公司|科技有限公司|建设|装饰|公司|集团|中心|院|所|局))'
    r'.{0,10}(?:是|为)'
    r'.{0,30}(?:客户|甲方|业主|发包方|合作方)'
    r'|([\u4e00-\u9fff（）()\u00b7]{2,6})'
    r'.{0,10}(?:是|为)'
    r'.{0,30}(?:客户|甲方)'
)

_PRICE_RE = re.compile(
    r'(\d{2,5})\s*(?:元|块|¥)'
    r'\s*(?:/|每)\s*(?:吨|kg|公斤|斤|天|日|月|年|方|平方米|平米)'
    r'|(?:价格|报价|单价|出厂价|运费|成本)[：:]\s*(\d{2,5})'
)

_PERSON_PHONE_RE = re.compile(
    r'([\u4e00-\u9fff\u00b7]{2,4})\s*(?:[：:]\s*)?(?:电话|手机|联系方式|联系)[：:]*\s*(1[3-9]\d{9})'
    r'|(?:联系人|找)\s*([\u4e00-\u9fff\u00b7]{2,4})\s*(?:[：:]\s*)?(1[3-9]\d{9})'
)

_PROJECT_RE = re.compile(
    r'([\u4e00-\u9fff\u00b7（）()]{2,12}(?:项目|工程|工地))'
    r'.{0,20}(?:通过|完成|验收|打款|施工|进场|交付|竣工|暂停|取消|延期)'
)

_DECISION_RE = re.compile(
    r'(?:决定|确认|确定|敲定|定了|拍板)[：:]?\s*'
    r'([\u4e00-\u9fff，,、]{8,50})'
)

# ============================================================
# 毒记忆拦截
# ============================================================

_POISON_PATTERNS = re.compile(
    r'系统[中目前前当暂只仅]|已录入|仅录入|信息不全|'
    r'需要补充|需要完善|需要补录|需要录入|未录入|尚未|暂无数据|'
    r'用户需要|用户要求|用户想知道|用户希望|用户已多次|'
    r'用户父亲|用户母亲|'
    r'数据为空|查询不到|找不到|没有找到|没有记录|'
    r'还不完整|还没录|还没.*录入|'
    r'需要我帮你|帮你拨通|拨通他的|你直接把|我先打个|要不要我|'
    r'我可以帮你|我来帮你|为你拨通|'
    r'不存在|已删除|不应该|不是客户|不在此表|请勿引用|'
    r'记忆库中|记忆里|记忆中的'
)


def _extract_structured_facts(user_message: str, ai_response: str) -> list[dict]:
    """白名单模式：只提取符合显式正则模式的事实"""
    combined = f"{user_message}\n{ai_response}"
    facts = []
    seen = set()

    def _add(content, mem_type, priority, source_type, confidence, scope='team', expires_days=None):
        key = content.strip()[:80]
        if key in seen:
            return
        seen.add(key)
        if _POISON_PATTERNS.search(content):
            return
        expires = None
        if expires_days:
            expires = datetime.now(timezone.utc) + timedelta(days=expires_days)
        facts.append({
            "content": content.strip()[:200],
            "type": mem_type,
            "priority": max(50, min(90, priority)),
            "source_type": source_type,
            "confidence": confidence,
            "scope": scope,
            "expires_at": expires,
        })

    # 供应商+电话
    for m in _SUPPLIER_RE.finditer(combined):
        name = m.group(1)
        pos = m.start()
        nearby = combined[max(0, pos-50):pos+100]
        phone_m = _PHONE_RE.search(nearby)
        if phone_m:
            _add(f"{name}是供应商，电话{phone_m.group(0)}", "fact", 75, "pattern_matched", 0.7, scope='team')
        else:
            _add(f"{name}是供应商", "fact", 60, "pattern_matched", 0.5, scope='team')

    # 客户+电话（与供应商对等）
    for m in _CUSTOMER_RE.finditer(combined):
        name = m.group(1) or m.group(2)
        if not name:
            continue
        pos = m.start()
        nearby = combined[max(0, pos-50):pos+100]
        phone_m = _PHONE_RE.search(nearby)
        if phone_m:
            _add(f"{name}是客户，电话{phone_m.group(0)}", "fact", 75, "pattern_matched", 0.7, scope='team')
        else:
            _add(f"{name}是客户", "fact", 60, "pattern_matched", 0.5, scope='team')

    # 价格
    for m in _PRICE_RE.finditer(combined):
        ctx_start = max(0, m.start() - 30)
        ctx_end = min(len(combined), m.end() + 30)
        context = combined[ctx_start:ctx_end].replace('\n', ' ').strip()
        _add(f"报价: {context}", "fact", 70, "pattern_matched", 0.6, scope='team', expires_days=90)

    # 人名+电话
    for m in _PERSON_PHONE_RE.finditer(combined):
        name = m.group(1) or m.group(3)
        phone = m.group(2) or m.group(4)
        if name and phone:
            _add(f"{name}电话{phone}", "person", 65, "pattern_matched", 0.7, scope='team')

    # 项目进展
    for m in _PROJECT_RE.finditer(combined):
        _add(m.group(0), "fact", 70, "pattern_matched", 0.6, scope='team')

    # 明确决策
    for m in _DECISION_RE.finditer(combined):
        _add(f"决策: {m.group(1)}", "decision", 80, "pattern_matched", 0.8, scope='team')

    # 用户消息中的声明性陈述 (must contain phone/price/name)
    for m in re.finditer(r'(?:[\u4e00-\u9fff\u00b7]{3,20}(?:公司|供应商|客户)).{0,15}(?:电话|联系|价格|报价)[^\n]{5,50}|(?:电话\s*1[3-9]\d{9}[^\n]{0,40})|(?:价格|报价)[^\n]{0,30}\d+元[^\n]{0,20}',
        user_message):
        text = m.group(0).strip()
        if len(text) >= 8 and not _POISON_PATTERNS.search(text):
            _add(text, "fact", 70, "user_stated", 0.9, scope='team')

    return facts[:8]


async def _llm_extract_facts(user_message: str, ai_response: str) -> list[dict]:
    """LLM辅助提取(仅补漏用, 低置信度)"""
    prompt = f"""分析对话，只提取用户明确陈述的具体事实。

规则:
1. 只提取用户说的客观事实: 名字、电话、价格、地址、决策
2. 不提取: 系统状态、AI解释、需求描述、行动计划
3. 每条不超过80字，没有事实返回[]

用户: {user_message[:1000]}
AI: {ai_response[:1000]}

返回JSON数组: [{{"content":"..."}}]"""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.DEEPSEEK_MODEL,
                    "messages": [
                        {"role": "system", "content": "你是JSON输出助手，只输出JSON数组。"},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 600,
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            memories = json.loads(text)
            if not isinstance(memories, list):
                return []

            valid = []
            for m in memories:
                if isinstance(m, dict) and "content" in m and m["content"].strip():
                    content = m["content"].strip()[:200]
                    if _POISON_PATTERNS.search(content):
                        continue
                    valid.append({
                        "content": content,
                        "type": "fact",
                        "priority": 55,
                        "source_type": "deduced",
                        "confidence": 0.4,
                        "scope": "personal",
                        "expires_at": None,
                    })
            return valid[:3]
    except Exception as e:
        logger.warning(f"LLM记忆提炼失败: {e}")
        return []


async def extract_memories_from_chat(
    user_message: str,
    ai_response: str,
) -> list[dict]:
    """提取对话记忆 (白名单优先 + LLM补漏)"""
    facts = _extract_structured_facts(user_message, ai_response)
    if len(facts) < 3:
        llm_facts = await _llm_extract_facts(user_message, ai_response)
        existing_contents = {f["content"][:60] for f in facts}
        for lf in llm_facts:
            if lf["content"][:60] not in existing_contents:
                facts.append(lf)
    return facts


async def store_memories(
    memories: list[dict],
    invite_code: str,
    tenant_id: str,
    session_id: str,
    file_ids: list[str] | None = None,
) -> int:
    """存储记忆 (语义去重 + 租户隔离)"""
    if not memories:
        return 0

    base_meta = {
        "auto_extracted": True,
        "provenance": [f"chat_session:{session_id}"],
    }
    if file_ids:
        base_meta["file_ids"] = file_ids

    stored = 0
    async with database.pool.acquire() as conn:
        from pgvector.asyncpg import register_vector
        await register_vector(conn)

        for mem in memories:
            memory_id = f"chat_{uuid.uuid4().hex[:12]}"
            content_hash = hashlib.sha256(mem["content"].encode()).hexdigest()[:16]

            # 去重1: SHA256
            existing = await conn.fetchval(
                "SELECT 1 FROM memories WHERE partner_id=$1 AND hash=$2 AND tenant_id=$3",
                invite_code, content_hash, tenant_id,
            )
            if existing:
                continue

            # embedding
            emb = None
            try:
                emb = await embedding.get_embedding(mem["content"])
            except Exception as e:
                logger.warning(f"embedding失败: {e}")

            # 去重2: 语义相似度
            if emb:
                similar = await conn.fetchrow(
                    """SELECT memory_id, content,
                              embedding <=> $1::vector AS distance
                       FROM memories
                       WHERE tenant_id=$2 AND embedding IS NOT NULL
                       ORDER BY embedding <=> $1::vector
                       LIMIT 1""",
                    emb, tenant_id,
                )
                if similar and similar["distance"] < 0.08:
                    new_meta = {
                        "original": similar["content"][:200],
                        "updated": mem["content"][:200],
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    if file_ids:
                        old_meta = similar.get("metadata") or {}
                        if isinstance(old_meta, str):
                            try: old_meta = json.loads(old_meta)
                            except (json.JSONDecodeError, TypeError): old_meta = {}
                        existing_files = old_meta.get("file_ids", []) or []
                        new_meta["file_ids"] = list(set(existing_files + file_ids))
                    new_meta_json = json.dumps(new_meta, ensure_ascii=False)
                    await conn.execute(
                        """UPDATE memories SET
                           content=$1, embedding=$2::vector, priority=$3,
                           source_type=$4, confidence=$5, scope=$6,
                           expires_at=$7, metadata=$8, updated_at=NOW()
                           WHERE memory_id=$9""",
                        mem["content"], emb, mem.get("priority", 50),
                        mem.get("source_type", "deduced"),
                        mem.get("confidence", 0.4),
                        mem.get("scope", "team"),
                        mem.get("expires_at"),
                        new_meta_json,
                        similar["memory_id"],
                    )
                    stored += 1
                    continue

            # INSERT
            await conn.execute(
                """INSERT INTO memories
                    (memory_id, partner_id, tenant_id, content, type, source, round,
                     priority, embedding, tags, metadata, hash,
                     source_type, confidence, scope, expires_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)""",
                memory_id, invite_code, tenant_id, mem["content"],
                mem.get("type", "fact"), f"chat:{session_id}", "",
                mem.get("priority", 50), emb,
                [], json.dumps(base_meta, ensure_ascii=False),
                content_hash,
                mem.get("source_type", "deduced"),
                mem.get("confidence", 0.4),
                mem.get("scope", "team"),
                mem.get("expires_at"),
            )
            stored += 1

    if stored > 0:
        logger.info(f"用户 {invite_code}(tenant={tenant_id}) 提炼了 {stored} 条记忆")
    return stored


async def extract_and_store(
    user_message: str,
    ai_response: str,
    invite_code: str,
    session_id: str,
    tenant_id: str = None,
    file_ids: list[str] | None = None,
) -> int:
    """完整流程 (fire-and-forget)"""
    try:
        memories = await extract_memories_from_chat(user_message, ai_response)
        stored = 0
        if memories:
            stored = await store_memories(memories, invite_code, tenant_id, session_id, file_ids=file_ids)
        # 同时写入entity_facts结构化表
        if tenant_id:
            ef_count = await _store_entity_facts(user_message, ai_response, invite_code, tenant_id)
        else:
            # 个人用户也用 invite_code 作为伪 tenant_id 写入 entity_facts（用于交易等事实提取）
            ef_count = await _store_entity_facts(user_message, ai_response, invite_code, "personal:" + invite_code)
            if ef_count:
                logger.info(f"entity_facts 写入 {ef_count} 条")
        return stored
    except Exception as e:
        logger.error(f"记忆提炼存储异常: {e}")
        return 0


# ============================================================
# entity_facts 结构化事实提取与存储
# ============================================================

# 材料类型关键词映射（与 biz_actions._MATERIAL_MAP 同步）
_ENTITY_MATERIAL_MAP = {
    "水泥": "水泥", "泥": "水泥",
    "钢材": "钢材", "钢筋": "钢材", "钢": "钢材", "螺纹钢": "钢材",
    "砂石": "砂石", "沙子": "砂石", "碎石": "砂石", "石子": "砂石",
    "砂浆": "砂浆",
    "涂料": "涂料", "油漆": "涂料", "乳胶漆": "涂料", "环氧": "涂料",
    "石材": "石材", "大理石": "石材", "花岗岩": "石材",
    "木材": "木材", "板材": "木材", "木方": "木材", "模板": "木材",
    "管线": "管线", "水管": "管线", "电线": "管线", "电缆": "管线",
    "防水": "防水", "卷材": "防水",
    "混凝土": "混凝土", "商混": "混凝土",
    "瓷砖": "瓷砖", "地砖": "瓷砖", "墙砖": "瓷砖",
    "门窗": "门窗", "铝合金": "门窗", "断桥铝": "门窗",
    "五金": "五金", "螺丝": "五金", "配件": "五金",
    "保温": "保温", "岩棉": "保温",
    "磨石": "磨石", "无机磨石": "磨石", "骨料": "磨石",
    "硅微粉": "硅微粉", "高岭土": "硅微粉", "高岭": "硅微粉",
    "建筑建材": "建筑建材", "建材": "建筑建材",
}

# 供应商名提取: 匹配已知公司后缀模式
_COMPANY_SUFFIX = r'(?:有限公司|科技有限公司|建筑材料|建设工程|建材|矿产品|装饰|新材|公司|工厂|厂家|涂料|化工|实业|科技|材料|集团)'
_SUPPLIER_NAME_RE = re.compile(
    rf'([\u4e00-\u9fff（）()\u00b7]{{2,16}}{_COMPANY_SUFFIX})'
)

# 清洗供应商名中的常见噪音前缀
_NAME_CLEANUP_RE = re.compile(r'^(?:[\u4e00-\u9fff]{0,2})?(?:叫|供应商叫|供应商|的供应商|录|录入|记录|添加|新增|个|一家|的是|是|联系|系|了)\s*')

# 联系人提取 - 使用非贪婪匹配避免吞入多余字符
_CONTACT_RE = re.compile(
    r'(?:联系人|找|联系)[：: ]*([\u4e00-\u9fff\u00b7]{2,4}?)(?:$|[\s，。,.]|[电话手机联])'
    r'|([\u4e00-\u9fff\u00b7]{2,4}?)\s*(?:电话|手机|联系方式)'
)

# 附加: "XX的报价/电话" 模式 (处理无公司后缀的供应商名)
_POSSESSIVE_NAME_RE = re.compile(
    r'([\u4e00-\u9fff（）()\u00b7]{3,20})(?:的报价|的价格|的电话|的联系方式)'
)


def _extract_entity_facts_from_messages(user_message: str, ai_response: str) -> list[dict]:
    """从对话中提取结构化实体事实，用于写入entity_facts表
    仅处理用户消息，避免AI幻觉回复中的虚假数据污染结构化事实表。
    """
    combined = user_message  # 仅处理用户消息，AI回复可能包含幻觉
    facts = []
    seen = set()

    def _add(entity_type, entity_name, field_name, field_value, confidence=0.5):
        if not entity_name or not field_value:
            return
        entity_name = entity_name.strip()[:100]
        field_value = field_value.strip()[:500]
        if len(entity_name) < 2 or len(field_value) < 1:
            return
        key = f"{entity_type}|{entity_name}|{field_name}|{field_value[:60]}"
        if key in seen:
            return
        if _POISON_PATTERNS.search(entity_name) or _POISON_PATTERNS.search(field_value):
            return
        seen.add(key)
        facts.append({
            "entity_type": entity_type,
            "entity_name": entity_name,
            "field_name": field_name,
            "field_value": field_value,
            "confidence": confidence,
        })

    # 1) 电话号码 + 附近人名/公司名
    for phone_m in _PHONE_RE.finditer(combined):
        phone = phone_m.group(0)
        # 在电话前后60字符中找实体名
        ctx_start = max(0, phone_m.start() - 60)
        ctx_end = min(len(combined), phone_m.end() + 60)
        nearby = combined[ctx_start:ctx_end]

        # 匹配公司名（优先公司后缀，退而求其次用"的报价/电话"模式）
        name_m = _SUPPLIER_NAME_RE.search(nearby)
        if not name_m:
            name_m = _POSSESSIVE_NAME_RE.search(nearby)
        if name_m:
            raw_name = name_m.group(1)
            clean_name = _NAME_CLEANUP_RE.sub('', raw_name).strip()
            if len(clean_name) >= 3:
                # 上下文判定：先检测客户/供应商关键词，都不匹配则标中性 company
                is_customer = False
                is_supplier = False
                # 客户上下文：含客户/甲方/业主/发包方/建设单位等关键词
                if re.search(r'(?:客户|甲方|业主|发包方|合作方|建设集团|建设工程)', nearby):
                    is_customer = True
                # 供应商上下文：含供应/供货/采购/厂家/材料商/进货等关键词
                if re.search(r'(?:供应|供货|采购|厂家|材料商|进货|买料|找.*料)', nearby):
                    is_supplier = True
                if is_customer:
                    _add("customer", clean_name, "phone", phone, 0.7)
                elif is_supplier:
                    _add("supplier", clean_name, "phone", phone, 0.7)
                else:
                    _add("company", clean_name, "phone", phone, 0.5)

        # 客户名 + 电话：匹配 "XX公司 客户" / "甲方XX" / "录客户" + 电话
        cust_m = _CUSTOMER_RE.search(nearby)
        # Also match broader customer patterns: "录/加/新建 个客户" context
        if not cust_m:
            cust_m = re.search(r'([\u4e00-\u9fff（）()\u00b7]{3,20}(?:有限公司|公司|集团))(?:的|是).{0,20}(?:客户|甲方)', nearby)
        if not cust_m:
            cust_m = re.search(r'(?:录|加|新建|录入).{0,5}(?:个|一).{0,5}(?:客户).{0,20}([\u4e00-\u9fff（）()\u00b7]{3,20}(?:有限公司|公司|集团)?)', nearby)
        if cust_m:
            raw_name = cust_m.group(1) or cust_m.group(3) or cust_m.group(2)
            if raw_name:
                clean_name = _NAME_CLEANUP_RE.sub('', raw_name).strip()
                if len(clean_name) >= 3:
                    _add("customer", clean_name, "phone", phone, 0.7)

        # 匹配联系人名
        contact_m = _CONTACT_RE.search(nearby)
        if contact_m:
            contact_name = contact_m.group(1) or contact_m.group(2)
            if contact_name and _NAME_CLEANUP_RE.sub('', contact_name).strip():
                clean_contact = _NAME_CLEANUP_RE.sub('', contact_name).strip()
                if len(clean_contact) >= 2:
                    _add("person", clean_contact, "phone", phone, 0.6)

    # 2) 材料类型（从消息关键词推断）
    material_type = None
    for keyword in sorted(_ENTITY_MATERIAL_MAP.keys(), key=len, reverse=True):
        if keyword in user_message:
            material_type = _ENTITY_MATERIAL_MAP[keyword]
            break

    # 3) 供应商名 + 材料类型（无电话但有明确"XX是XX供应商"模式）
    for m in _SUPPLIER_RE.finditer(combined):
        name = m.group(1)
        clean_name = _NAME_CLEANUP_RE.sub('', name).strip()
        if len(clean_name) < 2:
            continue
        if material_type:
            _add("supplier", clean_name, "material_type", material_type, 0.6)
        # 检查附近有无电话（已处理则跳过）
        nearby = combined[max(0, m.start()-60):m.end()+60]
        if not _PHONE_RE.search(nearby):
            _add("supplier", clean_name, "material_type", material_type or "未分类", 0.4)

    # 4) 价格（关联到前面找到的供应商名）
    for m in _PRICE_RE.finditer(combined):
        price_val = m.group(1) or m.group(2)
        if not price_val:
            continue
        ctx_start = max(0, m.start() - 40)
        ctx_end = min(len(combined), m.end() + 40)
        context = combined[ctx_start:ctx_end]
        # 尝试关联供应商名（优先公司后缀，退而求其次用"的报价"模式）
        name_m = _SUPPLIER_NAME_RE.search(context)
        if not name_m:
            name_m = _POSSESSIVE_NAME_RE.search(context)
        if name_m:
            entity_name = _NAME_CLEANUP_RE.sub('', name_m.group(1)).strip()
        else:
            entity_name = "未命名供应商"
        if len(entity_name) >= 2:
            _add("supplier", entity_name, "price", price_val, 0.5)

    # 5) 联系人+电话（来自人名电话模式）
    for m in _PERSON_PHONE_RE.finditer(combined):
        name = m.group(1) or m.group(3)
        phone = m.group(2) or m.group(4)
        if name and phone:
            clean_name = _NAME_CLEANUP_RE.sub('', name).strip()
            if len(clean_name) >= 2:
                _add("person", clean_name, "phone", phone, 0.7)

    # 6) 配方事实提取
    # 先尝试从"配方叫XX" / "XX配方"提取名称
    _RECIPE_NAME_FROM_CALL = re.compile(
        r'(?:录[个一]?\s*(?:个?\s*)?(?:配方|工艺)\s*(?:叫|名为|名叫|叫)?\s*'
        r'|(?:配方|工艺)\s*叫\s*)'
        r'([\u4e00-\u9fffA-Za-z0-9._-]{2,20})'
    )

    # 6a) "XX配方/原料A:B=2:1" → recipe ratio
    for m in re.finditer(
        r'([\u4e00-\u9fffA-Za-z0-9._-]{2,20})\s*(?:配[方比]|工艺)\s*'
        r'(?:的?\s*)?(?:原料|材料|配料|成分|含|是|包含|包括|需要|为)[：:\s]*'
        r'([^。，\n]{5,80})',
        combined
    ):
        recipe_name = _NAME_CLEANUP_RE.sub('', m.group(1)).strip()
        if '配方' in recipe_name or len(recipe_name) < 2:
            continue
        ratio_text = m.group(2).strip()[:200]
        if len(ratio_text) >= 2:
            _add("recipe", recipe_name, "ratio", ratio_text, 0.7)

    # 6b) "录配方叫XX" → 从后续内容提取配方名+原料
    for m in _RECIPE_NAME_FROM_CALL.finditer(combined):
        recipe_name = m.group(1).strip()
        if len(recipe_name) < 2:
            continue
        # 找配方名后面的原料描述
        rest = combined[m.end():m.end()+200]
        ing_m = re.search(r'(?:原料|材料|配料|成分)[：:\s]*([^。，\n]{5,80})', rest)
        if ing_m:
            _add("recipe", recipe_name, "ratio", ing_m.group(1).strip()[:200], 0.7)

    # 6c) "XX配方加Y%Z剂" / "XX配方加Y kg Z" → recipe additive
    # 先找配方名(在"配方/配比"之前), 再找添加量
    for m in re.finditer(
        r'([\u4e00-\u9fffA-Za-z0-9._-]{2,20})'
        r'\s*(?:配方|配比)'
        r'\s*(?:里[面头]?\s*)?(?:加|添加|掺|兑|额外加|再?加)\s*'
        r'(\d+(?:\.\d+)?\s*%?\s*[\u4e00-\u9fffA-Za-z]{2,20})',
        combined
    ):
        recipe_name = _NAME_CLEANUP_RE.sub('', m.group(1)).strip()
        if len(recipe_name) < 2:
            continue
        _add("recipe", recipe_name, "additive", m.group(2).strip()[:200], 0.6)

    # 6d) "XX养护/固化/干燥 T 小时/天" → recipe curing
    for m in re.finditer(
        r'([\u4e00-\u9fffA-Za-z0-9._-]{2,20})'
        r'\s*(?:配方|配比)?\s*'
        r'(?:的?\s*)?(?:养护|固化|干燥|晾干|烘干)'
        r'(?:时间|条件|温度)?[：:\s]*'
        r'(\d+(?:\.\d+)?\s*(?:小时|h|H|天|d|D|分钟|min))',
        combined
    ):
        recipe_name = _NAME_CLEANUP_RE.sub('', m.group(1)).strip()
        if len(recipe_name) < 2:
            continue
        # Don't capture "的" as part of recipe name
        if recipe_name.endswith('的'):
            recipe_name = recipe_name[:-1]
        _add("recipe", recipe_name, "curing", m.group(2).strip()[:200], 0.6)

    # ═══ 7) 交易/股票事实提取 ═══
    # 7a) 持仓标的 + 成本价: "拿着XX成本YY" / "XX持仓成本YY"
    for m in re.finditer(
        r'(?:拿着|持有|持仓|买了?|建仓|入了?)'
        r'([\u4e00-\u9fffA-Za-z]{2,10})\s*'
        r'(?:成本|买入价?|均价?|价格|价位)\s*'
        r'(\d+(?:\.\d+)?)',
        combined
    ):
        stock = m.group(1).strip()
        cost = m.group(2).strip()
        if stock and cost and len(stock) >= 2:
            _add("stock", stock, "cost_price", cost, 0.6)

    # 7a-var: "XX成本YY" 更简短模式
    for m in re.finditer(
        r'([\u4e00-\u9fffA-Za-z]{2,10})'
        r'\s*(?:成本|买入价?|均价?)\s*'
        r'(\d+(?:\.\d+)?)',
        combined
    ):
        stock = m.group(1).strip()
        cost = m.group(2).strip()
        if stock and cost and len(stock) >= 2:
            # filter false positives
            skip_words = {"用量", "已用", "还剩", "公斤", "价格", "报价", "共", "花了",
                         "持有", "买了", "入了", "建仓", "拿着", "持仓"}
            if stock not in skip_words and not any(s in stock for s in ["持有", "买了"]):
                _add("stock", stock, "cost_price", cost, 0.5)

    # 7b) 止损/止盈策略: "止损设在X%" / "止损X个点" / "跌破XX止损"
    for m in re.finditer(
        r'(?:止损|止盈)\s*(?:设在?|放在?|位置|点|价位?|线)?'
        r'\s*[：:\s]*'
        r'(\d+(?:\.\d+)?)\s*'
        r'(?:%|个点|块|元|点)?',
        combined
    ):
        val = m.group(1).strip()
        _add("trading_strategy", "当前策略", "stop_loss", val + "%", 0.5)

    # "跌破XX就止损/走人" 
    for m in re.finditer(
        r'跌破\s*(\d+(?:\.\d+)?)\s*(?:就|的?话)?\s*(?:止损|走|出|跑|卖)',
        combined
    ):
        _add("trading_strategy", "当前策略", "stop_loss_price", m.group(1).strip(), 0.6)

    # 7c) 仓位比例: "现在X成仓" / "仓位X成" / "满仓" / "半仓" / "$X万仓位"
    for m in re.finditer(
        r'(?:仓位|持仓)\s*(?:是|有|在|约|大约)?\s*'
        r'(\d+(?:\.\d+)?)\s*'
        r'(?:成|%|万|层)',
        combined
    ):
        val = m.group(1).strip()
        _add("trading_strategy", "当前策略", "position_size", val, 0.5)

    # "满仓" / "空仓" / "半仓" 
    for kw, val in [("满仓", "100%"), ("空仓", "0%"), ("半仓", "50%"), ("轻仓", "30%"), ("重仓", "70%")]:
        if kw in user_message:
            _add("trading_strategy", "当前策略", "position", val, 0.6)

    # 7d) 交易频率: "做短线" / "中线持有" / "波段操作"
    for kw, val in [("短线", "短线"), ("中线", "中线"), ("长线", "长线"), ("波段", "波段"),
                    ("超短", "超短线"), ("日内", "日内"), ("T+0", "T+0")]:
        if kw in user_message:
            _add("trading_strategy", "当前策略", "timeframe", val, 0.6)
            break

    # 7e) 盈亏记录: "赚了X%" / "亏了X万" / "这波赚了X"
    for m in re.finditer(
        r'(?:赚了|盈利|浮盈|获利|盈|利润)\s*'
        r'(\d+(?:\.\d+)?)\s*'
        r'(?:%|万|点|个点|块)?',
        combined
    ):
        _add("trading_performance", "近期盈亏", "profit", m.group(1).strip(), 0.5)

    for m in re.finditer(
        r'(?:亏了|亏损|浮亏|损失|亏|赔了)\s*'
        r'(\d+(?:\.\d+)?)\s*'
        r'(?:%|万|点|个点|块)?',
        combined
    ):
        _add("trading_performance", "近期盈亏", "loss", m.group(1).strip(), 0.5)

    return facts


async def _store_entity_facts(
    user_message: str,
    ai_response: str,
    invite_code: str,
    tenant_id: str,
) -> int:
    """将提取的结构化事实写入 entity_facts 表（语义去重 + UPSERT）"""
    facts = _extract_entity_facts_from_messages(user_message, ai_response)
    if not facts:
        return 0

    stored = 0
    
    # 预生成所有 embedding（在锁外执行，避免锁持有期间调用外部API）
    fact_embeddings = []
    for fact in facts:
        emb = None
        try:
            embed_text = f"{fact['entity_name']}:{fact['field_value']}"
            emb = await embedding.get_embedding(embed_text)
        except Exception as e:
            logger.warning(f"entity_facts embedding失败: {e}")
        fact_embeddings.append(emb)

    async with database.pool.acquire() as conn:
        # 租户级 advisory lock：防止并发写入 entity_facts 的 TOCTOU 竞态
        lock_key = f"entity_facts:{tenant_id}"
        await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1))", lock_key)
        logger.debug(f"[entity_facts] 获取租户锁 {lock_key}")

        from pgvector.asyncpg import register_vector
        await register_vector(conn)

        for idx, fact in enumerate(facts):
            emb = fact_embeddings[idx]
            # 去重：同一租户+实体类型+实体名+字段名 → UPSERT（锁保护下安全）
            existing = await conn.fetchrow("""
                SELECT id, field_value, confidence
                FROM entity_facts
                WHERE tenant_id=$1 AND entity_type=$2 AND entity_name=$3
                  AND field_name=$4 AND superseded_by IS NULL
            """, tenant_id, fact["entity_type"], fact["entity_name"], fact["field_name"])

            if existing:
                # 如果新的field_value不同且置信度不低于旧的，UPDATE
                if fact["field_value"] != existing["field_value"] and fact["confidence"] >= float(existing["confidence"] or 0.5):
                    await conn.execute("""
                        UPDATE entity_facts SET
                            field_value=$1, confidence=$2, source_user=$3,
                            embedding=$4::vector, updated_at=NOW()
                        WHERE id=$5
                    """, fact["field_value"], fact["confidence"], invite_code,
                       emb, existing["id"])
                    stored += 1
                continue

            # INSERT
            try:
                await conn.execute("""
                    INSERT INTO entity_facts
                        (tenant_id, entity_type, entity_name, field_name, field_value,
                         source_user, confidence, embedding)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector)
                """, tenant_id, fact["entity_type"], fact["entity_name"],
                   fact["field_name"], fact["field_value"],
                   invite_code, fact["confidence"], emb)
                stored += 1
            except Exception as e:
                # 唯一索引冲突（并发竞态，忽略）
                if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                    pass
                else:
                    logger.warning(f"entity_facts INSERT失败: {e}")

    return stored
