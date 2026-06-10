"""灵境 - 微信群聊消息AI归类分析服务

基于 DeepSeek 对群聊消息进行：
- 内容归类（材料讨论/施工进度/项目管理等）
- 摘要生成
- 项目关联检测
- 关键词/人物提取
"""
import json
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger("lingjing.wechat_analysis")

# ---------------------------------------------------------------
# 归类体系（地坪/建材行业）
# ---------------------------------------------------------------
CATEGORIES = {
    "material": "材料讨论",
    "progress": "施工进度",
    "project_mgmt": "项目管理",
    "finance": "财务付款",
    "personnel": "人员管理",
    "customer": "客户沟通",
    "quality": "质量安全",
    "procurement": "采购询价",
    "logistics": "物流运输",
    "chat": "闲聊通知",
    "unclassified": "未分类",
}

CATEGORY_KEYWORDS = {
    "material": ["材料", "砂", "水泥", "石子", "添加剂", "价格", "吨", "方", "采购", "料"],
    "progress": ["进场", "施工", "完工", "进度", "安排", "加班", "工期", "延期", "明天", "今天"],
    "project_mgmt": ["合同", "项目", "验收", "方案", "图纸", "变更", "甲方", "监理"],
    "finance": ["款", "付款", "结算", "发票", "对账", "工资", "费用", "预算", "成本"],
    "personnel": ["人", "工", "李工", "张工", "师傅", "请假", "考勤", "招人", "安排人"],
    "customer": ["客户", "业主", "老板", "报价", "需求", "投诉", "满意", "看"],
    "quality": ["质量", "问题", "整改", "不合格", "返工", "检查", "安全", "隐患"],
    "procurement": ["询价", "报价单", "供应商", "价格", "哪家", "便宜", "性价比"],
    "logistics": ["发货", "物流", "运输", "到货", "车", "送到", "地址", "收货"],
}


def _keyword_categorize(content: str) -> str:
    """基于关键词快速归类（无需AI调用的降级方案）"""
    c_lower = content.lower()
    scores = {}
    for cat, kws in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in kws if kw in c_lower)
        if score > 0:
            scores[cat] = score
    if scores:
        return max(scores, key=scores.get)
    return "unclassified"


def _build_analysis_prompt(messages: list[dict]) -> str:
    """构建AI归类分析的prompt"""
    msg_text = ""
    for i, m in enumerate(messages[:200]):  # 最多分析200条
        msg_text += f"{i+1}. [{m.get('sender','')}]: {m.get('content','')}\n"

    cats_desc = "\n".join(f"  - {k}: {v}" for k, v in CATEGORIES.items() if k != "unclassified")

    return f"""你是一个专业的工程管理助手，请分析以下微信群聊消息，完成三个任务：

## 任务1：消息归类
将每条消息归入以下类别之一：
{cats_desc}

## 任务2：生成摘要
用3-5句话总结该群聊的核心内容（进展、问题、决策）

## 任务3：提取关键信息
- 关键词标签（3-8个）
- 重要人物提及（谁在说什么）
- 可能的关联项目（内容是否涉及某个施工项目）
- 待办事项或行动项（需要谁做什么）

## 消息内容：
{msg_text}

请以JSON格式严格输出：
{{
    "categorized": [
        {{"index": 1, "category": "material", "reason": "讨论砂石价格"}},
        ...
    ],
    "summary": "群聊摘要...",
    "tags": ["关键词1", "关键词2"],
    "key_mentions": [{{"person": "张三", "topics": ["材料", "价格"], "count": 5}}],
    "suggested_projects": ["可能的项目名称或关联"],
    "action_items": [{{"what": "待办事项", "who": "负责人"}}]
}}"""


async def analyze_with_deepseek(prompt: str) -> Optional[dict]:
    """调用 DeepSeek AI 分析"""
    try:
        import config
        import httpx

        payload = {
            "model": config.DEEPSEEK_MODEL,
            "messages": [
                {"role": "system", "content": "你是灵境AI，专业的工程管理分析助手。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 4096,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{config.DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if resp.status_code != 200:
            logger.warning(f"DeepSeek API 返回 {resp.status_code}: {resp.text[:200]}")
            return None

        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        # 提取JSON
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.warning(f"AI返回JSON解析失败: {e}")
        return None
    except Exception as e:
        logger.error(f"DeepSeek调用失败: {e}")
        return None


async def analyze_group_messages(group_id: str, messages: list[dict]) -> dict:
    """对群消息进行完整AI分析

    返回:
        {
            "summary": "...",
            "categories": {"material": 10, "progress": 5, ...},
            "tags": [...],
            "key_mentions": [...],
            "suggested_projects": [...],
            "message_categories": {1: "material", 2: "progress", ...}  # index→category
        }
    """
    if not messages:
        return {
            "summary": "暂无消息数据",
            "categories": {}, "tags": [],
            "key_mentions": [], "suggested_projects": [],
            "message_categories": {},
        }

    prompt = _build_analysis_prompt(messages)
    result = await analyze_with_deepseek(prompt)

    if result is None:
        # 降级：关键词归类
        logger.info("DeepSeek分析失败，使用关键词降级归类")
        msg_cats = {}
        cat_counts = {}
        for i, m in enumerate(messages):
            cat = _keyword_categorize(m.get("content", ""))
            msg_cats[i] = cat
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

        result = {
            "summary": f"共分析 {len(messages)} 条消息，涵盖 {len(cat_counts)} 个类别。",
            "categories": {CATEGORIES.get(k, k): v for k, v in cat_counts.items()},
            "tags": list(cat_counts.keys()),
            "key_mentions": [],
            "suggested_projects": [],
            "message_categories": msg_cats,
        }
    else:
        # 整理归类结果
        msg_cats = {}
        cat_counts = {}
        for item in result.get("categorized", []):
            idx = item.get("index", 0) - 1
            cat = item.get("category", "unclassified")
            msg_cats[idx] = cat
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

        # 如果AI没返回归类，用关键词兜底
        for i in range(len(messages)):
            if i not in msg_cats:
                cat = _keyword_categorize(messages[i].get("content", ""))
                msg_cats[i] = cat
                cat_counts[cat] = cat_counts.get(cat, 0) + 1

        result["categories"] = {CATEGORIES.get(k, k): v for k, v in cat_counts.items()}
        result["message_categories"] = msg_cats

    return result


async def save_analysis_result(conn, group_id: str, tenant_id: str, analysis: dict,
                                date_from: str = "", date_to: str = "") -> int:
    """存储分析结果到数据库"""
    row = await conn.fetchrow(
        """INSERT INTO wechat_analysis
           (group_id, tenant_id, date_from, date_to, total_messages,
            categories, tags, summary, key_mentions, suggested_projects, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')
           RETURNING id""",
        group_id, tenant_id,
        date_from or None, date_to or None,
        sum(analysis.get("categories", {}).values()),
        json.dumps(analysis.get("categories", {})),
        analysis.get("tags", []),
        analysis.get("summary", ""),
        json.dumps(analysis.get("key_mentions", [])),
        json.dumps(analysis.get("suggested_projects", [])),
    )
    return row["id"] if row else 0


async def get_latest_analysis(conn, group_id: str) -> Optional[dict]:
    """获取最新的分析结果"""
    row = await conn.fetchrow(
        """SELECT id, group_id, date_from, date_to, total_messages,
                  categories, tags, summary, key_mentions, suggested_projects,
                  status, created_at
           FROM wechat_analysis
           WHERE group_id = $1 AND status = 'completed'
           ORDER BY created_at DESC
           LIMIT 1""",
        group_id,
    )
    if not row:
        return None
    return {
        "id": row["id"],
        "group_id": row["group_id"],
        "date_from": row["date_from"].isoformat() if row["date_from"] else "",
        "date_to": row["date_to"].isoformat() if row["date_to"] else "",
        "total_messages": row["total_messages"],
        "categories": row["categories"] if isinstance(row["categories"], dict) else json.loads(row["categories"] or "{}"),
        "tags": row["tags"] or [],
        "summary": row["summary"] or "",
        "key_mentions": row["key_mentions"] if isinstance(row["key_mentions"], list) else json.loads(row["key_mentions"] or "[]"),
        "suggested_projects": row["suggested_projects"] if isinstance(row["suggested_projects"], list) else json.loads(row["suggested_projects"] or "[]"),
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else "",
    }
