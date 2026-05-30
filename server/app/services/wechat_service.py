"""灵境 - 微信群聊消息解析与存储服务

增强自现有 import_service.py 的微信导入能力：
- 群聊识别（从导出文件自动提取群名）
- 消息结构化存储
- 多群管理
"""
import re
import json
import logging
import hashlib
from datetime import datetime
from typing import Optional

logger = logging.getLogger("lingjing.wechat")

# ---------------------------------------------------------------
# 正则模式
# ---------------------------------------------------------------
RE_GROUP_NAME = re.compile(r"(?:群聊名称|群名|群名称|群)：?\s*(\S+)")
RE_MSG_HEADER = re.compile(
    r"^(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+"
    r"([^(]+?)(?:\((\d{7,15})\))?\s*$"
)
RE_PHONE = re.compile(r"1[3-9]\d{9}")


def detect_group_name(lines: list[str], filename: str = "") -> str:
    """从导出文件内容 + 文件名推断群聊名称"""
    for line in lines[:30]:
        line = line.strip()
        m = RE_GROUP_NAME.search(line)
        if m:
            return m.group(1).strip()
    name = filename.rsplit(".", 1)[0] if "." in filename else filename
    name = name.replace("的聊天记录", "").replace("微信导出", "").strip()
    if name and name != filename:
        return name
    return "未命名群聊"


def parse_wechat_export(filepath: str, filename: str = "") -> dict:
    """解析微信导出的 TXT 聊天记录，返回结构化数据"""
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    lines = content.splitlines()
    group_name = detect_group_name(lines, filename)
    result = {
        "group_name": group_name, "messages": [], "members": [],
        "total_messages": 0, "total_members": 0,
    }
    member_set: set[str] = set()
    current_sender = ""
    current_time = ""
    current_content: list[str] = []

    def _save_current():
        nonlocal current_sender, current_time, current_content
        if not current_content:
            return
        msg_text = "\n".join(current_content).strip()
        if not msg_text:
            return
        raw = f"{current_time}|{current_sender}|{msg_text}"
        msg_id = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
        msg_time_iso = ""
        try:
            dt = datetime.strptime(current_time.strip(), "%Y-%m-%d %H:%M:%S")
            msg_time_iso = dt.isoformat()
        except ValueError:
            try:
                dt = datetime.strptime(current_time.strip(), "%Y-%m-%d %H:%M")
                msg_time_iso = dt.isoformat()
            except ValueError:
                msg_time_iso = current_time
        result["messages"].append({
            "sender": current_sender if current_sender else "未知",
            "time": current_time, "content": msg_text,
            "msg_id": msg_id, "msg_time_iso": msg_time_iso,
        })
        current_content = []

    for line in lines:
        line = line.strip()
        if not line:
            if current_content:
                _save_current()
            continue
        m = RE_MSG_HEADER.match(line)
        if m:
            _save_current()
            current_time = m.group(1)
            sender = m.group(2).strip()
            phone = m.group(3) if m.group(3) else ""
            if sender in ("我", "Me", ""):
                current_sender = "我"
            else:
                current_sender = sender
                if not phone:
                    pm = RE_PHONE.search(sender)
                    if pm:
                        phone = pm.group(0)
                        sender_clean = RE_PHONE.sub("", sender).strip()
                        current_sender = sender_clean or sender
                member_set.add(current_sender)
        else:
            current_content.append(line)
    if current_content:
        _save_current()
    result["members"] = sorted(member_set)
    result["total_messages"] = len(result["messages"])
    result["total_members"] = len(member_set)
    return result


# ---------------------------------------------------------------
# 数据库操作
# ---------------------------------------------------------------

def _gen_group_id(tenant_id: str, group_name: str) -> str:
    raw = f"{tenant_id}:{group_name}"
    return "g_" + hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]


async def ensure_group(conn, tenant_id: str, group_name: str, member_count: int = 0) -> str:
    group_id = _gen_group_id(tenant_id, group_name)
    await conn.execute(
        """INSERT INTO wechat_groups (group_id, tenant_id, name, member_count, source, updated_at)
           VALUES ($1, $2, $3, $4, 'import', NOW())
           ON CONFLICT (group_id) DO UPDATE
           SET name = EXCLUDED.name,
               member_count = GREATEST(wechat_groups.member_count, EXCLUDED.member_count),
               is_active = TRUE, updated_at = NOW()""",
        group_id, tenant_id, group_name, member_count,
    )
    return group_id


async def save_messages_batch(conn, group_id: str, tenant_id: str, messages: list[dict]) -> dict:
    inserted = 0
    skipped = 0
    for msg in messages:
        try:
            raw_time = msg.get("msg_time_iso")
            if raw_time:
                try:
                    msg_time_val = datetime.fromisoformat(raw_time)
                except (ValueError, TypeError):
                    msg_time_val = None
            else:
                msg_time_val = None
            result = await conn.execute(
                """INSERT INTO wechat_messages
                   (msg_id, group_id, tenant_id, sender_name, content, msg_type, msg_time)
                   VALUES ($1, $2, $3, $4, $5, 'text', $6)
                   ON CONFLICT (msg_id) DO NOTHING""",
                msg["msg_id"], group_id, tenant_id, msg["sender"], msg["content"], msg_time_val,
            )
            # asyncpg returns "INSERT 0 N" where N = rows actually inserted
            # N=0 when ON CONFLICT skips, N>0 when row is inserted
            if not result.endswith(' 0'):
                inserted += 1
        except Exception as e:
            logger.warning(f"保存消息失败: {e}")
            skipped += 1
    await conn.execute(
        """UPDATE wechat_groups
           SET total_messages = (SELECT COUNT(*) FROM wechat_messages WHERE group_id = $1),
               last_msg_at = (SELECT MAX(msg_time) FROM wechat_messages WHERE group_id = $1),
               updated_at = NOW()
           WHERE group_id = $1""", group_id,
    )
    return {"inserted": inserted, "skipped": skipped}


# ---------------------------------------------------------------
# OCR 截图解析
# ---------------------------------------------------------------

async def parse_ocr_text(ocr_text: str) -> list[dict]:
    """将moondream OCR识别出的文字解析为结构化微信消息
    输入: moondream返回的图片文字识别结果
    输出: [{"sender":"张三","time":"2026-05-29 14:30","content":"你好","msg_id":"sha256"}]
    """
    import hashlib
    messages = []
    lines = ocr_text.strip().split("\n")
    current_sender = "未知"
    current_time = ""
    current_content = []

    # 常见微信截图时间格式: "14:30" 或 "2026-05-29 14:30"
    re_time = re.compile(r"^\s*(?:(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+)?(\d{1,2}:\d{2})\s*$")
    # 发送者模式: "张三:" 或 "张三：" 或 "[张三]"
    re_sender = re.compile(r"^\[?([^\]:\n]{1,20}?)[\]：:]\s*(.*)")
    # "我:" 特殊处理
    re_me = re.compile(r"^我[：:]\s*(.*)")
    # 纯时间戳行
    re_timestamp = re.compile(r"^\d{1,2}:\d{2}(:\d{2})?$")

    def _save():
        nonlocal current_sender, current_time, current_content
        if not current_content:
            return
        text = "\n".join(current_content).strip()
        if not text or len(text) < 1:
            current_content = []
            return
        raw = f"{current_time}|{current_sender}|{text}"
        msg_id = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
        messages.append({
            "sender": current_sender,
            "time": current_time or "",
            "content": text,
            "msg_id": msg_id,
            "msg_time_iso": current_time or "",
        })
        current_content = []

    for line in lines:
        line = line.strip()
        if not line:
            if current_content:
                _save()
            continue
        # 跳过纯数字行（可能是截图角标）
        if re.match(r"^\d{1,3}$", line):
            continue
        # 时间行
        tm = re_time.match(line)
        if tm:
            _save()
            date_part = tm.group(1)
            time_part = tm.group(2)
            current_time = f"{date_part} {time_part}" if date_part else time_part
            continue
        # "我:" 开头
        mm = re_me.match(line)
        if mm:
            _save()
            current_sender = "我"
            rest = mm.group(1).strip()
            if rest:
                current_content.append(rest)
            continue
        # "发送者:" 开头
        sm = re_sender.match(line)
        if sm:
            _save()
            current_sender = sm.group(1).strip()
            rest = sm.group(2).strip()
            if rest:
                current_content.append(rest)
            continue
        # 普通内容行
        current_content.append(line)
    if current_content:
        _save()
    return messages


async def parse_raw_text(text: str, default_group: str = "粘贴的聊天记录") -> dict:
    """解析用户粘贴的原始微信聊天文本
    支持格式:
    - "张三: 你好\n李四: 收到" (简单对话)
    - 带时间戳的导出格式
    """
    import hashlib
    import uuid

    lines = text.strip().split("\n")
    group_name = default_group
    messages = []
    members = set()

    # 尝试检测群名 - 匹配后跳过该行（非消息）
    gn = re.search(r"(?:群聊|群名|群名称)[：:]\s*(\S+)", text[:200])
    if gn:
        group_name = gn.group(1).strip()

    # 过滤掉元数据行（群名称等），避免被当作消息
    _meta_prefixes = ("群名称", "群聊", "群名", "聊天记录", "导出时间", "消息数")

    current_sender = "未知"
    current_time = ""
    current_content = []

    re_ts = re.compile(r"^(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+([^(]+?)(?:\(\d+\))?\s*$")
    re_time = re.compile(r"^\s*(?:(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+)?(\d{1,2}:\d{2})\s*$")
    re_sender = re.compile(r"^\[?([^\]：:\n]{1,20}?)[\]：:]\s*(.*)")
    re_me = re.compile(r"^我[：:]\s*(.*)")

    def _save():
        nonlocal current_sender, current_time, current_content
        if not current_content:
            return
        ct = "\n".join(current_content).strip()
        if not ct or len(ct) < 1:
            current_content = []
            return
        raw_id = f"{current_time}|{current_sender}|{ct}|{uuid.uuid4().hex[:8]}"
        msg_id = hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:32]
        messages.append({
            "sender": current_sender,
            "time": current_time,
            "content": ct,
            "msg_id": msg_id,
            "msg_time_iso": current_time,
        })
        current_content = []

    for line in lines:
        line = line.strip()
        if not line:
            if current_content:
                _save()
            continue
        # 标准导出格式: "2024-01-01 14:30 张三(138xxx)"
        tm = re_ts.match(line)
        if tm:
            _save()
            current_time = tm.group(1)
            current_sender = tm.group(2).strip()
            members.add(current_sender)
            continue
        # "我:" 开头
        mm = re_me.match(line)
        if mm:
            _save()
            current_sender = "我"
            rest = mm.group(1).strip()
            if rest:
                current_content.append(rest)
            continue
        # "发送者:" 开头
        sm = re_sender.match(line)
        if sm:
            _save()
            candidate = sm.group(1).strip()
            # 跳过元数据行
            if candidate in _meta_prefixes:
                continue
            current_sender = candidate
            members.add(current_sender)
            rest = sm.group(2).strip()
            if rest:
                current_content.append(rest)
            continue
        current_content.append(line)
    if current_content:
        _save()

    return {
        "group_name": group_name,
        "messages": messages,
        "members": sorted(members),
        "total_messages": len(messages),
        "total_members": len(members),
    }


async def list_groups(conn, tenant_id: str, page: int = 1, page_size: int = 20) -> dict:
    offset = (page - 1) * page_size
    total = await conn.fetchval(
        "SELECT COUNT(*) FROM wechat_groups WHERE tenant_id = $1 AND is_active = TRUE", tenant_id
    )
    rows = await conn.fetch(
        """SELECT group_id, name, member_count, source, total_messages,
                  last_msg_at, created_at
           FROM wechat_groups
           WHERE tenant_id = $1 AND is_active = TRUE
           ORDER BY last_msg_at DESC NULLS LAST
           LIMIT $2 OFFSET $3""", tenant_id, page_size, offset,
    )
    groups = []
    for r in rows:
        groups.append({
            "group_id": r["group_id"], "name": r["name"],
            "member_count": r["member_count"], "source": r["source"],
            "total_messages": r["total_messages"],
            "last_msg_at": r["last_msg_at"].isoformat() if r["last_msg_at"] else "",
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
        })
    return {"groups": groups, "total": total, "page": page, "page_size": page_size}


async def get_group_detail(conn, group_id: str, tenant_id: str) -> Optional[dict]:
    row = await conn.fetchrow(
        """SELECT group_id, name, member_count, source, total_messages,
                  last_msg_at, is_active, created_at, updated_at
           FROM wechat_groups WHERE group_id = $1 AND tenant_id = $2""",
        group_id, tenant_id,
    )
    return dict(row) if row else None


async def list_messages(conn, group_id: str, tenant_id: str,
                        page: int = 1, page_size: int = 50, category: str = "") -> dict:
    offset = (page - 1) * page_size
    cond = "group_id = $1 AND tenant_id = $2"
    params = [group_id, tenant_id]
    idx = 3
    if category:
        cond += f" AND category = ${idx}"
        params.append(category)
        idx += 1
    total = await conn.fetchval(f"SELECT COUNT(*) FROM wechat_messages WHERE {cond}", *params)
    rows = await conn.fetch(
        f"""SELECT id, msg_id, sender_name, content, msg_type, msg_time,
                   category, tags, project_id, is_analyzed, summary, created_at
            FROM wechat_messages WHERE {cond}
            ORDER BY msg_time ASC NULLS LAST
            LIMIT ${idx} OFFSET ${idx+1}""", *params, page_size, offset,
    )
    messages = []
    for r in rows:
        messages.append({
            "id": r["id"], "msg_id": r["msg_id"], "sender": r["sender_name"],
            "content": r["content"], "msg_type": r["msg_type"],
            "msg_time": r["msg_time"].isoformat() if r["msg_time"] else "",
            "category": r["category"], "tags": r["tags"] or [],
            "project_id": r["project_id"], "is_analyzed": r["is_analyzed"],
            "summary": r["summary"] or "",
        })
    return {"messages": messages, "total": total, "page": page, "page_size": page_size}


async def get_dashboard_stats(conn, tenant_id: str) -> dict:
    cat_rows = await conn.fetch(
        """SELECT category, COUNT(*) as cnt
           FROM wechat_messages WHERE tenant_id = $1 AND category != 'unclassified'
           GROUP BY category ORDER BY cnt DESC""", tenant_id,
    )
    categories = {r["category"]: r["cnt"] for r in cat_rows}
    total_groups = await conn.fetchval(
        "SELECT COUNT(*) FROM wechat_groups WHERE tenant_id = $1 AND is_active = TRUE", tenant_id
    )
    total_msgs = await conn.fetchval(
        "SELECT COUNT(*) FROM wechat_messages WHERE tenant_id = $1", tenant_id
    )
    analyzed_msgs = await conn.fetchval(
        "SELECT COUNT(*) FROM wechat_messages WHERE tenant_id = $1 AND is_analyzed = TRUE", tenant_id
    )
    linked_msgs = await conn.fetchval(
        "SELECT COUNT(*) FROM wechat_messages WHERE tenant_id = $1 AND project_id IS NOT NULL", tenant_id
    )
    trend_rows = await conn.fetch(
        """SELECT DATE(msg_time) as d, COUNT(*) as cnt
           FROM wechat_messages
           WHERE tenant_id = $1 AND msg_time >= NOW() - INTERVAL '7 days'
           GROUP BY d ORDER BY d""", tenant_id,
    )
    trend = {str(r["d"]): r["cnt"] for r in trend_rows}
    return {
        "total_groups": total_groups, "total_messages": total_msgs,
        "analyzed_messages": analyzed_msgs, "linked_messages": linked_msgs,
        "categories": categories, "trend_7d": trend,
    }


async def update_message_category(conn, msg_id: int, tenant_id: str, category: str, tags: list[str] = None) -> bool:
    if tags is None:
        tags = []
    result = await conn.execute(
        "UPDATE wechat_messages SET category = $1, tags = $2, is_analyzed = TRUE WHERE id = $3 AND tenant_id = $4",
        category, tags, msg_id, tenant_id,
    )
    # result is a command tag like "UPDATE 1", extract the number
    parts = result.split()
    count = int(parts[-1]) if len(parts) > 1 and parts[-1].isdigit() else 0
    return count > 0


async def link_message_to_project(conn, msg_id: int, tenant_id: str, project_id: int) -> bool:
    result = await conn.execute(
        "UPDATE wechat_messages SET project_id = $1 WHERE id = $2 AND tenant_id = $3",
        project_id, msg_id, tenant_id,
    )
    parts = result.split()
    count = int(parts[-1]) if len(parts) > 1 and parts[-1].isdigit() else 0
    return count > 0


async def batch_link_messages(conn, msg_ids: list[int], tenant_id: str, project_id: int) -> int:
    result = await conn.execute(
        "UPDATE wechat_messages SET project_id = $1 WHERE id = ANY($2) AND tenant_id = $3",
        project_id, msg_ids, tenant_id,
    )
    parts = result.split()
    return int(parts[-1]) if len(parts) > 1 and parts[-1].isdigit() else 0
