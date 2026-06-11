"""灵境平台 - 上下文组装服务（记忆检索 + 对话历史 + 系统提示词）"""
import json
import re
import math
import asyncio
import logging
from datetime import datetime, timezone
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database, embedding
from .industry_config import get_ai_addon
from .token_compressor import compress_memories, compress_file_context

# 灵境核心人格 - 系统提示词（精简版，~800字）
# 业务上下文注入（企业身份/能力/记忆/数据/通知）放到此 prompt 之后动态拼接
SYSTEM_PROMPT = """你的名字叫「灵境」，不是Gemma、不是AI助手。你是灵境——看得透人心、但懂分寸的对话伙伴。看穿问题，把方案摆出来，不当面说"你错了"。

核心原则：
1. 看破不说破 — 摆出正确路径，让用户自己比较反思。不说"你不对"，说"换我可能会考虑……"
2. 不迎合不恭维 — 不说"您说得太对了"，平等真诚，不卑不亢
3. 给方案不给评判 — 你不是裁判，是参谋。分析局势、理清思路、给可行的路
4. 有温度不廉价 — 不叫"亲爱的""朋友"，不说模板话。用细节体现实在听：引用用户说过的话
5. 聪明不炫耀 — 帮人找台阶下，不让用户觉得你在炫技
6. 不确定就说不知道 — 数据/进度记不清就直说，宁可说不确定也不编造
7. ⚠️ 严禁虚构业务数据 — 客户/供应商/项目/工人的名称、电话、联系人等信息，只能从系统返回的`[查询结果]`中引用。如果系统未返回任何数据，必须说"系统中暂无记录"。绝对禁止自己编造客户名、供应商名、项目名等业务数据。如果你不确定某个数据是否真实，宁可说"我查一下"再执行查询，也不要凭记忆编造。

语气：平和、真诚、偶尔幽默。像见过世面的老朋友。

回复要求：简洁（300字内），先理清处境再给建议，用提问引导而非指责。

7. 电话处理 — 见客户/供应商电话时主动问是否拨打，用户同意后在回复加 `[灵境拨号:号码]`
8. 冷启动 — 不说"有什么可以帮你的"，说"来了，最近有什么想聊聊的？" 用具体话题钩子开场。如果你看到「上次对话重点回顾」，说明用户之前聊过这些事，自然地带入对话中（如"上次聊到的那个XX后来怎么样了？"），让用户感到被记得
9. 网络搜索 — 收到 `[灵境搜索报告]` 时表示已为用户搜索了网络。把报告内容自然呈现给用户，标注"信息来自网络，仅供参考"。若报告显示"未找到"，如实告知并建议更精确的关键词。用户问行情/价格/竞品/标准/政策等需要外部信息的问题时，可建议"要不我帮你搜一下？"""

# 交易领域知识注入（检测到交易关键词时自动注入个人用户系统提示词）
_TRADING_KNOWLEDGE_PROMPT = """

---
你面对的用户是一位交易者。以下是你在交易话题上的思考框架。

**核心定位**
你不推荐操作、不预测市场、不给买卖建议。你的价值是帮交易者看清自己的决策模式和情绪循环。

**交易心理洞察**
- 交易者的敌人不是市场，是自己的情绪循环：贪婪→追高被套→恐惧→割在地板→后悔→追回本→再次贪婪
- 当用户描述一笔交易时，不要评价对错，帮他看清这笔交易发生时的情绪状态
- 典型信号：
  用户说"要是再拿一拿就好了" = 后视偏差，让他看到自己不是在后悔结果而是在后悔过程
  用户说"感觉要涨了" = 情绪驱动，帮他梳理"这个感觉最近准确率多少"
  用户说"打到止损就认" = 纪律清醒，值得肯定
- 你的价值是让用户从"这笔赚了亏了"转向"我做这个决策时处于什么状态、这个模式我重复过几次"

**风控常识**
- 仓位管理 > 选股能力。单票满仓是赌博不是交易
- 没有止损纪律的盈利单只是一颗定时炸弹
- 连续亏损3笔建议暂停1天复盘——不是能力问题是人会变形
- 回撤超过20%，优先检讨系统而非寻找下一只"回本股"

**交易知识体系（可以讲解的概念）**
- 技术指标原理：MACD的零轴意义、均线的趋势确认、量价关系的本质
- 市场结构：支撑/压力的形成逻辑、趋势/盘整的识别
- 资金管理：仓位计算公式（凯利公式思想）、盈亏比思维
- 行为金融学：损失厌恶、确认偏误、过度自信、锚定效应
- 交易系统构建：入场条件→仓位→止损→止盈→复盘，五个环节缺一不可

**不要做的**
- 不推荐具体股票（不说代码、名称、"可以关注XX"也不行）
- 不预测涨跌、不画支撑压力位、不给目标价
- 不帮人算"这只股能涨到多少"、"现在能不能买"
- 不给"现在是买点吗"的答案——反问"你的止损在哪、仓位几个点、持仓周期多长"

**可以做的**
- 帮用户梳理交易记录、总结亏损模式
- 帮用户构建和审视交易纪律（书面化、可量化）
- 用提问帮他看清自己是不是在重复某种错误
- 用苏格拉底式对话让他自己得出结论：不是"你错了"而是"你发现了什么" """




_KW_STOP = frozenset(
    "帮我 请问 告诉 一下 什么 怎么 为什么 可以 能不能 有没有 "
    "调出 调取 查看 查询 查一下 看看 找到 给我 我要 我想 "
    "帮我调出 帮我调取 帮我查 帮我找 帮我看 帮查 帮我 帮我查一下 查一下 "
    "的 了 吗 呢 啊 吧 是 在 把 和 对 这 那 也 都 到 谁 是谁".split()
)

# 常见业务关键词直接提取（不参与分词）
_BIZ_KEYWORDS = [
    "供应商", "客户", "项目", "材料", "砂石", "骨料", "水泥", "添加剂",
    "电话", "价格", "报价", "合同", "打卡", "考勤", "工资", "日薪",
    "配方", "样板", "打样", "施工", "进度", "结算", "备用金", "财务",
    "工人", "项目经理", "管理员", "技术员", "成员",
    # 股票/交易领域
    "股票", "炒股", "交易", "持仓", "止损", "止盈", "仓位",
    "K线", "MACD", "均线", "量价", "盘口", "龙虎榜", "涨停", "跌停",
    "波段", "短线", "中线", "长线", "T+0", "打板", "低吸", "追涨",
    "回踩", "突破", "支撑", "压力", "资金", "北向", "主力", "散户",
    "盈亏", "回撤", "复利", "胜率", "盈亏比", "风控",
]


def _extract_keywords(query: str) -> list[str]:
    """从查询中提取有效关键词（先精确匹配业务词，再分词退避）"""
    keywords = []

    # 1) 英文/数字编号（如 K800, V12.1）
    codes = re.findall(r'[A-Za-z0-9][A-Za-z0-9._-]+', query)
    keywords.extend(codes)

    # 2) 精确匹配业务关键词
    for kw in _BIZ_KEYWORDS:
        if kw in query:
            keywords.append(kw)

    # 3) 中文词：先移除停用词，再提取
    cleaned = query
    for stop in sorted(_KW_STOP, key=len, reverse=True):
        cleaned = cleaned.replace(stop, " ")
    cn = re.findall(r'[\u4e00-\u9fff]{2,}', cleaned)
    for w in cn:
        if w not in _KW_STOP and w not in keywords:
            keywords.append(w)

    # 去重并限制数量
    seen = set()
    unique = []
    for k in keywords:
        if k not in seen:
            seen.add(k)
            unique.append(k)

    return unique[:8]


async def retrieve_memories(query: str, limit: int = 10, invite_code: str | None = None, tenant_id: str | None = None, user_role: str = "member") -> list[dict]:
    """混合检索记忆（向量 + 关键词 + RRF 融合 + 租户过滤 + 时间衰减 + 置信度加权）
    
    - 同租户: owner/admin 可见全team记忆, 其它角色可见team+personal
    - 时间衰减: score *= e^(-0.005 * days_since_creation)
    - 置信度加权: score *= (0.5 + 0.5 * confidence)
    - 过期记忆自动过滤
    """
    if not invite_code:
        return []
    
    now = datetime.now(timezone.utc)
    
    emb = None
    # 查询含数字或ID时跳过embedding（关键词搜索更快命中）
    if not re.search(r'(?:#|编号|\d+|号样板|项目|客户)', query):
        try:
            emb = await asyncio.wait_for(embedding.get_embedding(query), timeout=2.0)
        except (asyncio.TimeoutError, Exception) as e:
            logging.getLogger("lingjing.context").warning(f"检索embedding失败: {type(e).__name__}: {e}")
    
    k = 60
    kw_boost = 1.5
    scores: dict[str, float] = {}
    items: dict[str, dict] = {}
    
    # 构建参数化租户过滤条件（防SQL注入）
    where_parts = ["(expires_at IS NULL OR expires_at > NOW())"]
    if tenant_id:
        where_params = [tenant_id, invite_code]
        where_parts.append("((tenant_id = $1 AND scope = 'team') OR (partner_id = $2))")
    else:
        where_params = [invite_code]
        where_parts.append("(partner_id = $1)")
    
    async with database.pool.acquire() as conn:
        from pgvector.asyncpg import register_vector
        await register_vector(conn)
        
        # ── 1) 向量搜索 ──
        if emb:
            np = len(where_params)
            where_clause = " AND ".join(where_parts)
            vec_rows = await conn.fetch(f"""
                SELECT memory_id, partner_id, content, type, source, priority,
                       confidence, created_at, metadata,
                       embedding <=> ${np + 1}::vector AS distance
                FROM memories
                WHERE embedding IS NOT NULL 
                  AND {where_clause}
                ORDER BY embedding <=> ${np + 1}::vector
                LIMIT ${np + 2}
            """, *where_params, emb, limit * 5)
            
            for rank, r in enumerate(vec_rows):
                rid = r["memory_id"]
                # 置信度加权: 0.5~1.0
                conf = float(r.get("confidence") or 0.5)
                conf_weight = 0.5 + 0.5 * conf
                # 时间衰减: λ=0.005, 100天后衰减到61%
                days = (now - r["created_at"]).days if r["created_at"] else 0
                time_decay = math.exp(-0.005 * max(0, days))
                # 优先级提升
                pri_boost = (r["priority"] - 50) / 400.0
                
                scores[rid] = scores.get(rid, 0) + conf_weight * time_decay * (1.0 / (k + rank + 1)) + pri_boost
                if rid not in items:
                    items[rid] = {
                        "memory_id": rid, "partner_id": r["partner_id"],
                        "content": r["content"][:500], "type": r["type"],
                        "source": r["source"], "confidence": conf,
                        "metadata": r.get("metadata") or {},
                    }
        
        # ── 2) 关键词搜索 ──
        keywords = _extract_keywords(query)
        if keywords:
            np = len(where_params)
            kw_where = list(where_parts)
            kw_params = list(where_params)
            for i, kw in enumerate(keywords[:5]):
                kw_where.append(f"content ILIKE '%' || ${np + i + 1} || '%'")
                kw_params.append(kw)
            where_clause = " AND ".join(kw_where)
            
            kw_rows = await conn.fetch(f"""
                SELECT memory_id, partner_id, content, type, source, priority,
                       confidence, created_at, metadata
                FROM memories
                WHERE {where_clause}
                ORDER BY priority DESC, created_at DESC
                LIMIT ${np + len(keywords[:5]) + 1}
            """, *kw_params, limit * 5)
            
            for rank, r in enumerate(kw_rows):
                rid = r["memory_id"]
                conf = float(r.get("confidence") or 0.5)
                conf_weight = 0.5 + 0.5 * conf
                days = (now - r["created_at"]).days if r["created_at"] else 0
                time_decay = math.exp(-0.005 * max(0, days))
                pri_boost = (r["priority"] - 50) / 400.0
                
                scores[rid] = scores.get(rid, 0) + kw_boost * conf_weight * time_decay * (1.0 / (k + rank + 1)) + pri_boost
                if rid not in items:
                    items[rid] = {
                        "memory_id": rid, "partner_id": r["partner_id"],
                        "content": r["content"][:500], "type": r["type"],
                        "source": r["source"], "confidence": conf, "metadata": r.get("metadata") or {},
                    }
    
    # ── 3) RRF 融合排序 ──
    results = []
    for rid, item in items.items():
        item["relevance"] = round(scores[rid], 6)
        results.append(item)
    results.sort(key=lambda x: x["relevance"], reverse=True)
    
    # 兜底: 如果太少，用priority补
    if len(results) < 3 and tenant_id:
        async with database.pool.acquire() as conn:
            np = len(where_params)
            where_clause = " AND ".join(where_parts)
            fallback = await conn.fetch(f"""
                SELECT memory_id, partner_id, content, type, source, priority, confidence, metadata
                FROM memories
                WHERE {where_clause}
                ORDER BY priority DESC, created_at DESC
                LIMIT ${np + 1}
            """, *where_params, limit)
        for r in fallback:
            rid = r["memory_id"]
            if rid not in items:
                items[rid] = {
                    "memory_id": rid, "partner_id": r["partner_id"],
                    "content": r["content"][:500], "type": r["type"],
                    "source": r["source"], "confidence": float(r.get("confidence") or 0.5), "metadata": r.get("metadata") or {},
                }
                scores[rid] = r["priority"] / 900.0
        results = []
        for rid, item in items.items():
            item["relevance"] = round(scores[rid], 6)
            results.append(item)
        results.sort(key=lambda x: x["relevance"], reverse=True)
    

    # ── 解析记忆关联的图片 URL ──
    file_ids_to_resolve = set()
    for item in results:
        meta = item.get("metadata") or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except (json.JSONDecodeError, TypeError): meta = {}
        ids = meta.get("file_ids", []) or []
        for fid in ids:
            file_ids_to_resolve.add(fid)
    if file_ids_to_resolve:
        try:
            from services.oss_service import get_cdn_url
            async with database.pool.acquire() as conn2:
                mf_rows = await conn2.fetch(
                    "SELECT file_id, stored_path, file_type FROM message_files WHERE file_id = ANY($1)",
                    list(file_ids_to_resolve),
                )
            id_to_url = {}
            for mfr in mf_rows:
                sp = mfr["stored_path"]
                if sp.startswith("uploads/"):
                    id_to_url[mfr["file_id"]] = get_cdn_url(sp)
                elif sp.startswith("http"):
                    id_to_url[mfr["file_id"]] = sp
            for item in results:
                meta = item.get("metadata") or {}
                if isinstance(meta, str):
                    try: meta = json.loads(meta)
                    except (json.JSONDecodeError, TypeError): meta = {}
                # 从记忆的file_ids中收集对应图片URL
                ids = meta.get("file_ids", []) or []
                img_urls = [id_to_url[fid] for fid in ids if fid in id_to_url]
                if img_urls:
                    item["image_urls"] = img_urls
        except Exception:
            pass
    return results[:limit]


async def get_chat_history(session_id: str, limit: int = 10) -> list[dict]:
    """获取最近N轮对话历史"""
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT role, content FROM chat_messages
               WHERE session_id=$1
               ORDER BY created_at DESC
               LIMIT $2""",
            session_id, limit * 2,  # user+assistant 各算一条
        )
    # 反转为时间正序
    messages = [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
    return messages


async def get_team_notifications(tenant_id: str) -> list[dict]:
    """获取管理员的待处理团队通知"""
    if not tenant_id:
        return []
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT type, target_user_id, target_user_name, data, created_at
               FROM tenant_notifications
               WHERE tenant_id=$1 AND status='pending'
               ORDER BY created_at DESC LIMIT 10""",
            tenant_id,
        )
    return [
        {
            "type": r["type"],
            "target_user_id": r["target_user_id"],
            "target_user_name": r["target_user_name"],
            "data": json.loads(r["data"]) if isinstance(r["data"], str) else (r["data"] or {}),
        }
        for r in rows
    ]


async def get_user_project_info(tenant_id: str, username: str) -> dict | None:
    """获取用户绑定的项目信息"""
    if not tenant_id or not username:
        return None
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT role, ext_data FROM tenant_users WHERE tenant_id=$1 AND user_id=$2",
            tenant_id, username,
        )
    if not row:
        return None
    ext = json.loads(row["ext_data"]) if isinstance(row["ext_data"], str) else (row["ext_data"] or {})
    if not ext.get("project_id"):
        return None
    return {
        "project_name": ext.get("project_name", ""),
        "role": row["role"],
        "worker_type": ext.get("worker_type", ""),
        "daily_wage": ext.get("daily_wage", ""),
    }


async def retrieve_recent_key_memories(
    invite_code: str | None = None,
    tenant_id: str | None = None,
    current_session_id: str | None = None,
    limit: int = 3,
) -> list[dict]:
    """跨会话检索近期高优先级关键记忆（新会话冷启动时主动唤起）
    
    - 仅取 priority >= 60 且 confidence >= 0.6 的近期记忆
    - 排除当前会话的记忆
    - 按 priority DESC, created_at DESC 排序
    - 返回精简内容（150字截断）
    """
    if not invite_code:
        return []
    
    where_parts = ["(expires_at IS NULL OR expires_at > NOW())", "priority >= 60", "confidence >= 0.6"]
    params = [invite_code]
    idx = 2
    
    if tenant_id:
        params.append(tenant_id)
        where_parts.append(f"(tenant_id = ${idx} OR partner_id = $1)")
        idx += 1
    else:
        where_parts.append("(partner_id = $1)")
    
    if current_session_id:
        params.append(current_session_id)
        where_parts.append(f"(metadata->>'session_id' IS DISTINCT FROM ${idx} OR metadata->>'session_id' IS NULL)")
        idx += 1
    
    where_clause = " AND ".join(where_parts)
    
    async with database.pool.acquire() as conn:
        rows = await conn.fetch(f"""
            SELECT memory_id, content, type, source, priority, confidence, created_at, metadata
            FROM memories
            WHERE {where_clause}
            ORDER BY priority DESC, created_at DESC
            LIMIT ${idx}
        """, *params, limit)
    
    results = []
    for r in rows:
        meta = r.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                logging.getLogger("lingjing.context").warning("记忆metadata JSON解析失败", exc_info=True)
                meta = {}
        results.append({
            "memory_id": r["memory_id"],
            "content": r["content"][:150],
            "type": r["type"],
            "priority": r["priority"],
            "confidence": float(r.get("confidence") or 0.5),
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
            "source": r["source"],
            "metadata": meta,
        })
    return results


def build_messages(
    user_message: str,
    chat_history: list[dict],
    memories: list[dict],
    business_context: str | None = None,
    tenant_info: dict | None = None,
    file_contexts: list[dict] | None = None,
    team_notifications: list[dict] | None = None,
    user_project_info: dict | None = None,
    trading_review: str | None = None,
    cross_session_memories: list[dict] | None = None,
    weekly_report: dict | None = None,
) -> tuple[list[dict], list[str]]:
    """
    组装发送给AI的完整消息列表。
    tenant_info: 来自 get_current_user()，包含 company_name/owner_name/industry/tenant_role 等
    team_notifications: 管理员的待处理团队通知列表
    user_project_info: 当前用户绑定的项目信息 {project_name, role, worker_type, daily_wage}
    trading_review: 交易用户的复盘上下文（仅个人+交易用户，来自 trading_review.format_review_context）
    返回 (messages, memory_ids)
    """
    messages = []

    # 1. 系统提示词
    system_content = SYSTEM_PROMPT

    # 2. 如果是企业用户，动态注入业务管家角色
    if tenant_info and tenant_info.get("tenant_id"):
        company = tenant_info.get("company_name") or "你的企业"
        nickname = tenant_info.get("nickname") or "用户"
        owner = tenant_info.get("owner_name") or nickname
        industry = tenant_info.get("industry") or ""
        industry_addon = get_ai_addon(industry)
        tenant_role = tenant_info.get("tenant_role") or "member"

        # 根据角色确定身份描述
        if tenant_role in ("owner", "admin"):
            identity = f"用户是{owner}，{company}的管理员。"
        elif tenant_role == "project_manager":
            identity = f"用户是{nickname}，{company}的项目经理。"
        elif tenant_role == "worker":
            identity = f"用户是{nickname}，{company}的工人。"
        elif tenant_role == "technician":
            identity = f"用户是{nickname}，{company}的技术员（负责产品研发和配方管理）。"
            system_content += """

你可以帮技术员完成以下操作：
- 录入样板（说「录样板」+ 拍照上传 + 说配方 → 照片和配方一同保存）
- 调出/查找样板（说「水磨石面层样板」「3号样板」→ 模糊搜索，图片和配方一起显示）
- 录入新客户（说「录个客户叫XX，电话1XX」→ 样板需要绑定客户）
- 查客户信息（说「客户有哪些」→ 查看已录入的客户列表，含优先级排序）
- 更新客户状态（说「把XX的状态改为洽谈中」→ 支持9种状态：咨询中/待跟进/洽谈中/已签约/施工中/已交付/质保中/休眠客户/无效客户）
- 录入新产品配方（说「新增配方叫XX」，说原料配比）
- 打卡签到
- 样板完成后说「样品发给工厂调试大样」→ 系统记录发工厂
注意：你没有权限查询项目考勤/工资/财务等管理数据，也没有录入供应商的权限。"""
        else:
            identity = f"用户是{nickname}，{company}的新成员（尚未分配角色）。"

        system_content += f"""

你同时也是{company}的AI业务管家。{identity}
{industry_addon}
当你看到 [灵境已执行] 标记时，说明灵境已经自动完成了用户要求的操作，你只需确认并告知结果。
当你看到 [灵境需要补充信息] 标记时，请代为向用户询问缺少的信息。
当你看到 [灵境权限提示] 标记时，说明用户没有该操作的权限，请友好地转告，不要自行尝试执行。"""

        # ── 按角色注入能力说明 ──
        if tenant_role in ("owner", "admin"):
            system_content += """

你可以帮管理员完成以下操作：
- 录客户、录供应商、报工、记费用、建项目（用户不需要打开任何后台或网页）
- 管理供应商（录入、归类、查报价），说"采购XX"自动调出相关供应商
- 设定团队成员角色（工人/项目经理/管理员/技术员）
- 绑定/解绑成员到项目（一人一项目）
- 查询团队打卡和工资情况、客户、合同、财务、供应商等所有业务数据
- 查询费用记录时，如费用关联了单据图片，要主动告知用户"这笔费用有X张单据"
- 当看到 [灵境待办事项] 时，在回复中提及最重要的2-3项待办，引导用户处理
- 审批费用：用户说"批准XX的费用"时自动执行 approve_finance，"驳回"则 reject_finance
- 完成待办：用户说"完成待办3"时执行 complete_todo，也可说"搞定了"标记最近的
- 生成合同：用户说「帮我做一份合同」「生成施工合同」→ 自动调用模板生成，包含项目/甲方/乙方/金额/地址/工期
- 审核合同：用户说「审核这个合同」并上传合同文件 → 以甲方立场法务审核，逐条列出风险点和修改建议
设定工人角色时，要追问工种和日薪。绑定项目时要确认具体哪个项目。

⚠️ 重要：客户/供应商/项目等信息只能从系统查询结果中引用。当用户询问"有哪些客户/供应商"时，先执行查询，然后严格按照查询结果回答。如果查询结果是"暂无数据"，就说"系统中暂无记录"。严禁自己编造客户名、公司名、联系人等信息。"""

            # 注入待处理通知
            if team_notifications:
                notif_text = "\n\n[灵境团队通知]\n"
                for n in team_notifications:
                    if n["type"] == "new_member":
                        notif_text += f"- 新成员「{n['target_user_name']}」通过邀请码加入了团队，请告诉我给他设定什么角色（如：工人、项目经理等）\n"
                system_content += notif_text

        elif tenant_role == "project_manager":
            system_content += """

你可以帮项目经理完成以下操作：
- 打卡、报工、费用记录、更新项目进度、录入供应商
- 申请备用金
- 绑定/解绑工人到本项目
- 查询本项目的考勤、工资、财务、工序进展、供应商等数据
- 查询费用时如有关联单据图片，主动告知用户
注意：创建项目、录入客户、设定角色等操作需要联系管理员。"""

        elif tenant_role == "worker":
            system_content += """

你可以帮工人完成以下操作：
- 打卡（说"到了"或"打卡"上班，说"下班"或"收工"下班）
- 申请备用金
- 查询自己的考勤和工资
其他操作（报工、记费用、建项目等）需要联系管理员或项目经理。"""

        elif tenant_role == "technician":
            # 技术员的能力提示在角色注入前已添加（见上面 technician block）
            pass
        else:
            # member: 尚未分配角色
            system_content += """

该用户刚刚通过邀请码加入团队，尚未被管理员分配角色。
目前只能进行普通对话，无法执行任何业务操作。
请引导用户联系管理员分配角色（工人、项目经理等）后才能使用业务功能。"""

        # 工人/项目经理/技术员：注入项目信息和打卡引导
        if user_project_info and user_project_info.get("project_name"):
            pname = user_project_info["project_name"]
            system_content += f"\n\n用户当前绑定的项目是「{pname}」。"
            if tenant_role == "worker":
                wtype = user_project_info.get("worker_type", "")
                wage = user_project_info.get("daily_wage", "")
                if wtype:
                    system_content += f"工种：{wtype}。"
                if wage:
                    system_content += f"日薪：{wage}元。"
            elif tenant_role == "technician":
                system_content += "上传样板时，请关联到此项目的打样需求。"
            system_content += "用户可以说'打卡'或'到了'来记录出勤，说'下班'或'收工'记录下班。"
        elif tenant_role in ("worker", "project_manager", "technician") and not user_project_info:
            system_content += "\n\n用户还没有绑定项目，打卡前需要联系管理员安排项目。"

        # 注入业务数据
        if business_context:
            system_content += """

当用户问到业务相关的问题时，基于以下实时数据回答，数据都来自公司的管理系统。
用简洁的语言汇报，像一个值得信赖的助手。如果发现异常数据要主动提醒。

===== 实时业务数据 =====
""" + business_context + "\n===== 数据结束 ====="

    # 3. 如果有相关记忆，附加到系统提示词（经Token压缩）
    memory_ids = []
    if memories:
        # 压缩记忆：限制总量，避免冲淡系统提示词
        compressed_memories = compress_memories(memories, max_total_tokens=600, max_per_memory_tokens=100)
        memory_text = "\n\n---\n以下是与当前话题相关的记忆，可以自然地融入对话但不要直接复述：\n"
        img_lines = []
        for m in compressed_memories:
            label = "个人记忆" if m.get("source", "").startswith("chat:") else m["partner_id"]
            memory_text += f"- [{label}] {m['content'][:200]}\n"
            memory_ids.append(m["memory_id"])
            # 记忆关联的图片 URL
            urls = m.get("image_urls") or []
            for u in urls:
                img_lines.append(f"  📷 关联图片: {u}")
        if img_lines:
            memory_text += "\n".join(img_lines) + "\n"
        system_content += memory_text
        
        # 检测是否为交易/股票用户 — 记忆含交易关键词时注入交易领域知识
        _trading_keywords = ["股票", "交易", "炒股", "持仓", "止损", "K线", "仓位", "盈亏", "打板", "波段"]
        is_trader = any(kw in m.get("content", "") for m in memories for kw in _trading_keywords)
        if is_trader and not (tenant_info and tenant_info.get("tenant_id")):
            system_content += _TRADING_KNOWLEDGE_PROMPT

    # 5. 跨会话关键记忆注入（新会话冷启动时主动唤起）
    if cross_session_memories:
        cross_text = "\n\n---\n📌 上次对话重点回顾（这些是用户之前聊过的重要内容，请自然地引用到对话中，让用户感到被记得）：\n"
        for m in cross_session_memories:
            label = "记忆"
            if m.get("type"):
                label = m["type"]
            cross_text += f"- [{label}] {m['content'][:150]}\n"
        system_content += cross_text

    # 6. 个人成长报告注入（新会话时带入最新周报）
    if weekly_report and weekly_report.get("content"):
        rpt = weekly_report
        report_text = f"""

---
📊 你的本周成长报告（{rpt.get('period_start', '')} - {rpt.get('period_end', '')}）：

{rpt['content']}

---
请在对话中自然地引用这份报告，比如"这周辛苦了，你的成长报告出来了"。如果用户问起最近状态，可以简要回顾报告中的要点。不要逐字复述整份报告。"""
        system_content += report_text

    # 交易复盘上下文注入（来自 trading_review 引擎，仅在本次对话中）
    if trading_review:
        system_content += trading_review

    messages.append({"role": "system", "content": system_content})

    # 3. 对话历史
    for msg in chat_history:
        if msg["role"] in ("user", "assistant"):
            messages.append(msg)

    # 4. 当前用户消息（如有文件附件，注入文件内容，经Token压缩）
    final_user_message = user_message
    if file_contexts:
        # 压缩文件内容：减少 token 消耗
        compressed_files = compress_file_context(file_contexts, max_total_chars=3000, max_per_file_chars=1200)
        file_parts = []
        for fc in compressed_files:
            type_label = {"image": "图片", "pdf": "PDF", "word": "Word", "excel": "Excel", "video": "视频"}.get(fc["type"], "文件")
            file_parts.append(f"[{type_label}] {fc['name']}: {fc['context_text']}")
        file_section = "===== 用户上传的文件 =====\n" + "\n\n".join(file_parts) + "\n===== 文件内容结束 =====\n\n"
        final_user_message = file_section + user_message

    messages.append({"role": "user", "content": final_user_message})

    return messages, memory_ids
