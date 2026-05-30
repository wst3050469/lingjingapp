"""灵境 - 外部数据导入解析服务

支持导入来源：
- 微信聊天记录导出文件（TXT / HTML）
- 手机短信 JSON 批量导入
- 手机通讯录 JSON / vCard 批量导入

数据流向：
  外部数据 → parse_*() → 结构化 dict → 写入 import_records + import_contacts
                                        → 自动匹配 biz_customers
                                        → 可选同步到 memories
"""
import re
import logging
from bs4 import BeautifulSoup

logger = logging.getLogger("lingjing.import")

# ──────────────────────────────────────────────
# 正则模式
# ──────────────────────────────────────────────

# 微信TXT导出：日期时间 人名(电话)  或  日期时间 人名
RE_WECHAT_HEADER = re.compile(
    r"^(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+"
    r"(.+?)(?:\((\d{7,15})\))?\s*$"
)
RE_PHONE = re.compile(r"1[3-9]\d{9}")


def parse_wechat_txt(filepath: str) -> dict:
    """解析微信导出的 TXT 聊天记录

    格式:
        2026-05-20 14:30:00 张三(13800138000)
        消息内容...

    返回:
        {
            "contacts": [{"name": "张三", "phone": "13800138000", ...}],
            "messages": [{"sender": "张三", "time": "...", "content": "..."}],
            "total_contacts": N,
            "total_messages": N
        }
    """
    result = {"contacts": [], "messages": [], "total_contacts": 0, "total_messages": 0}
    contact_map: dict[str, dict] = {}  # phone → contact

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    current_sender = ""
    current_time = ""
    current_content = []

    for line in lines:
        line = line.strip()
        if not line:
            # 空行 → 保存上一条消息
            if current_content:
                _save_message(result, contact_map, current_sender, current_time, current_content)
                current_content = []
            continue

        m = RE_WECHAT_HEADER.match(line)
        if m:
            # 新消息头 → 保存上一条
            if current_content:
                _save_message(result, contact_map, current_sender, current_time, current_content)
                current_content = []

            current_time = m.group(1)
            sender = m.group(2).strip()
            phone = m.group(3) if m.group(3) else ""

            # 跳过"我"或空发送者
            if sender in ("我", "Me", ""):
                current_sender = "我"
            else:
                current_sender = sender
                # 提取消息中可能隐藏的电话
                if not phone:
                    phone_match = RE_PHONE.search(sender)
                    if phone_match:
                        phone = phone_match.group(0)
                        # 去掉sender中的电话号码
                        sender_clean = RE_PHONE.sub("", sender).strip()
                        sender = sender_clean if sender_clean else sender

                # 添加到联系人映射
                contact_key = phone if phone else sender
                if contact_key and contact_key not in contact_map:
                    contact_map[contact_key] = {
                        "name": sender,
                        "phone": phone,
                        "source": "wechat",
                    }
        else:
            # 消息内容行
            current_content.append(line)

    # 最后一条
    if current_content:
        _save_message(result, contact_map, current_sender, current_time, current_content)

    result["contacts"] = list(contact_map.values())
    result["total_contacts"] = len(contact_map)
    result["total_messages"] = len(result["messages"])
    return result


def parse_wechat_html(filepath: str) -> dict:
    """解析微信导出的 HTML 聊天记录

    HTML结构因微信版本而异，常见模式:
        <div class="message">
            <div class="sender">张三</div>
            <div class="time">2026-05-20 14:30</div>
            <div class="content">消息内容</div>
        </div>
    """
    result = {"contacts": [], "messages": [], "total_contacts": 0, "total_messages": 0}
    contact_map: dict[str, dict] = {}

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        html = f.read()

    soup = BeautifulSoup(html, "html.parser")

    # 尝试多种可能的选择器
    messages = soup.select(
        ".message, .chat-message, [class*=msg], .bubble, li.message"
    ) or soup.find_all(["div", "li"], class_=lambda c: c and "message" in c.lower())

    for msg in messages:
        # 提取发送者
        sender_el = msg.select_one(
            ".sender, .nickname, .name, [class*=sender], [class*=user], .avatar"
        )
        sender = sender_el.get_text(strip=True) if sender_el else ""

        # 提取时间
        time_el = msg.select_one(
            ".time, .date, .timestamp, [class*=time], [class*=date]"
        )
        time_str = time_el.get_text(strip=True) if time_el else ""

        # 提取内容
        content_el = msg.select_one(
            ".content, .text, .bubble-content, [class*=content], [class*=bubble], .message-text"
        )
        content = content_el.get_text(strip=True) if content_el else msg.get_text(strip=True)

        if not content or not sender:
            continue

        if sender in ("我", "Me"):
            sender_name = "我"
        else:
            sender_name = sender
            phone = ""
            phone_match = RE_PHONE.search(sender)
            if phone_match:
                phone = phone_match.group(0)
            contact_key = phone if phone else sender_name
            if contact_key and contact_key not in contact_map:
                contact_map[contact_key] = {
                    "name": sender_name,
                    "phone": phone,
                    "source": "wechat",
                }

        result["messages"].append({
            "sender": sender_name,
            "time": time_str,
            "content": content,
        })

    result["contacts"] = list(contact_map.values())
    result["total_contacts"] = len(contact_map)
    result["total_messages"] = len(result["messages"])
    return result


def parse_sms_batch(sms_list: list[dict]) -> dict:
    """解析短信批量导入数据

    输入格式:
        [{"address": "13800138000", "body": "...", "date": "...", "type": 1}]
    """
    result = {"contacts": [], "messages": [], "total_contacts": 0, "total_messages": 0}
    contact_map: dict[str, dict] = {}

    for sms in sms_list:
        address = sms.get("address", "")
        body = sms.get("body", "")
        date = sms.get("date", "")

        if not address or not body:
            continue

        # 提取联系人信息
        if address not in contact_map:
            contact_map[address] = {
                "name": address,  # 短信只有号码，暂用号码做名称
                "phone": address,
                "source": "sms",
            }

        # 短信作为消息
        result["messages"].append({
            "sender": address,
            "time": date,
            "content": body,
            "type": "sms",
        })

    result["contacts"] = list(contact_map.values())
    result["total_contacts"] = len(contact_map)
    result["total_messages"] = len(result["messages"])
    return result


def parse_contacts_batch(contacts: list[dict]) -> dict:
    """解析通讯录批量导入数据

    输入格式:
        [{"name": "张三", "phones": ["13800138000"], "company": "XX公司"}]
    """
    result = {"contacts": [], "total_contacts": 0}

    for c in contacts:
        name = c.get("name", "").strip()
        phones = c.get("phones", [])
        if isinstance(phones, str):
            phones = [phones]
        company = c.get("company", "").strip()

        if not name and not phones:
            continue

        phone_str = ",".join(p for p in phones if RE_PHONE.match(p))
        if not phone_str and not name:
            continue

        result["contacts"].append({
            "name": name,
            "phone": phone_str,
            "company": company,
            "source": "contacts",
        })

    result["total_contacts"] = len(result["contacts"])
    return result


async def dedup_contacts(tenant_id: str, contacts: list[dict], db_pool) -> tuple[list[dict], list[dict]]:
    """对导入联系人去重：与已有 import_contacts 和 biz_customers 比对

    Returns:
        (new_contacts, duplicate_contacts)
    """
    new_list = []
    dup_list = []

    # 收集所有电话
    all_phones = set()
    for c in contacts:
        phones = [p.strip() for p in c.get("phone", "").split(",") if p.strip()]
        all_phones.update(phones)

    if not all_phones:
        return contacts, []

    async with db_pool.acquire() as conn:
        # 查已有客户
        phone_list = list(all_phones)
        placeholders = ",".join(f"${i+1}" for i in range(len(phone_list)))
        existing = await conn.fetch(
            f"SELECT id, name, phone FROM biz_customers "
            f"WHERE tenant_id=${len(phone_list)+1} AND phone IN ({placeholders})",
            *phone_list, tenant_id
        )
        existing_phones = {r["phone"]: {"id": r["id"], "name": r["name"]} for r in existing}

        # 查已导入的联系人
        imported = await conn.fetch(
            f"SELECT phone FROM import_contacts "
            f"WHERE tenant_id=${len(phone_list)+1} AND phone IN ({placeholders})",
            *phone_list, tenant_id
        )
        imported_phones = set(r["phone"] for r in imported)

    for c in contacts:
        phones = [p.strip() for p in c.get("phone", "").split(",") if p.strip()]
        is_dup = False

        for p in phones:
            if p in existing_phones:
                c["matched_customer_id"] = existing_phones[p]["id"]
                is_dup = True
            if p in imported_phones:
                is_dup = True

        if is_dup:
            c["is_duplicate"] = True
            dup_list.append(c)
        else:
            new_list.append(c)

    return new_list, dup_list


def _save_message(result: dict, contact_map: dict, sender: str, time_str: str, content_lines: list):
    """保存一条解析出的消息"""
    content = "\n".join(content_lines).strip()
    if not content:
        return
    result["messages"].append({
        "sender": sender,
        "time": time_str,
        "content": content,
    })
