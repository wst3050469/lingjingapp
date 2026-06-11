"""灵境 - 企业微信（WeCom）集成服务

提供：
1. 企业微信API接入（access_token获取与管理）
2. 回调消息接收与解密（AES-256-CBC）
3. 消息格式转换（企业微信消息 → 灵境统一格式）
4. 通讯录同步
5. 应用消息发送
"""
import json
import logging
import time
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional

logger = logging.getLogger("lingjing.wecom")

# ── 常量 ─────────────────────────────────────────────────────
WECOM_API_BASE = "https://qyapi.weixin.qq.com/cgi-bin"

# 企业微信消息类型到灵境source的映射
WECOM_SOURCE = "enterprise_wechat"

# Token缓存（全局变量，避免每次请求都重新获取）
_token_cache: dict = {
    "access_token": "",
    "expires_at": 0,
}


async def get_access_token(corp_id: str, agent_secret: str) -> Optional[str]:
    """获取企业微信access_token（带缓存，2小时有效期）"""
    now = time.time()
    if _token_cache["access_token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["access_token"]

    if not corp_id or not agent_secret:
        logger.error("企业微信未配置：缺少 CorpID 或 AgentSecret")
        return None

    import httpx
    url = f"{WECOM_API_BASE}/gettoken?corpid={corp_id}&corpsecret={agent_secret}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()
            if data.get("errcode") == 0:
                token = data["access_token"]
                expires_in = data.get("expires_in", 7200)
                _token_cache["access_token"] = token
                _token_cache["expires_at"] = now + expires_in
                logger.info("企业微信 access_token 获取成功")
                return token
            else:
                logger.error(f"获取access_token失败: {data}")
                return None
    except Exception as e:
        logger.error(f"获取access_token请求异常: {e}")
        return None


# ── 回调消息解密 ──────────────────────────────────────────────

def _build_aes_key(encoding_aes_key: str) -> bytes:
    """将企业微信的EncodingAESKey（Base64编码的43位字符串）转为AES密钥"""
    import base64
    return base64.b64decode(encoding_aes_key + "=")


def decrypt_callback(encoding_aes_key: str, msg_encrypt: str) -> Optional[dict]:
    """解密企业微信回调消息（AES-256-CBC, PKCS7填充）
    
    返回解密后的XML字典，或None表示解密失败。
    """
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.primitives import padding
        import base64

        aes_key = _build_aes_key(encoding_aes_key)

        # Base64解码密文
        encrypted = base64.b64decode(msg_encrypt)

        # 解密（AES-256-CBC，IV取密钥前16字节）
        iv = aes_key[:16]
        cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        decrypted = decryptor.update(encrypted) + decryptor.finalize()

        # 移除PKCS7填充
        unpadder = padding.PKCS7(128).unpadder()
        decrypted = unpadder.update(decrypted) + unpadder.finalize()

        # 解析明文：长度(4字节网络序) + XML内容 + 企业微信CorpID(16字节)
        # 格式: [4字节消息体长度][消息体XML][CorpID]
        msg_len = int.from_bytes(decrypted[:4], byteorder="big")
        xml_content = decrypted[4:4 + msg_len].decode("utf-8")
        # receiveid = decrypted[4 + msg_len:].decode("utf-8")

        # 解析XML
        return _parse_xml(xml_content)
    except Exception as e:
        logger.error(f"解密企业微信回调消息失败: {e}")
        return None


def verify_url(encoding_aes_key: str, token: str,
               msg_signature: str, timestamp: str,
               nonce: str, echostr: str) -> Optional[str]:
    """验证企业微信回调URL（GET请求验证）
    
    返回解密后的echostr明文，或None表示验证失败。
    """
    # 1. 验证签名
    if not _verify_signature(token, msg_signature, timestamp, nonce, echostr):
        logger.warning("企业微信URL验证签名失败")
        return None

    # 2. 解密echostr
    try:
        result = decrypt_callback(encoding_aes_key, echostr)
        if result:
            # 从中提取明文内容
            return result.get("Content", "")
        return None
    except Exception as e:
        logger.error(f"解密echostr失败: {e}")
        return None


# ── 签名验证 ──────────────────────────────────────────────────

def _verify_signature(token: str, msg_signature: str,
                      timestamp: str, nonce: str,
                      msg_encrypt: str = "") -> bool:
    """验证企业微信回调消息签名（SHA1）"""
    if not all([token, msg_signature, timestamp, nonce]):
        return False
    tmp_list = sorted([token, timestamp, nonce, msg_encrypt])
    tmp_str = "".join(tmp_list)
    calc_sig = hashlib.sha1(tmp_str.encode()).hexdigest()
    return calc_sig == msg_signature


# ── XML解析 ───────────────────────────────────────────────────

def _parse_xml(xml_body: str) -> dict:
    """解析XML为字典"""
    root = ET.fromstring(xml_body)
    msg = {}
    for child in root:
        msg[child.tag] = child.text or ""
    return msg


def parse_callback_xml(xml_body: bytes) -> dict:
    """解析企业微信回调推送的XML消息体"""
    return _parse_xml(xml_body.decode("utf-8"))


# ── 消息格式转换 ──────────────────────────────────────────────

WECOM_MSG_TYPE_MAP = {
    "text": "text",
    "image": "image",
    "voice": "voice",
    "video": "video",
    "file": "file",
    "location": "location",
    "link": "link",
    "event": "event",
}


def convert_to_wechat_message(wecom_msg: dict) -> dict:
    """将企业微信回调消息转换为灵境 wechat_messages 格式"""
    import uuid

    msg_type = wecom_msg.get("MsgType", "text")
    content = ""

    if msg_type == "text":
        content = wecom_msg.get("Content", "")
    elif msg_type == "image":
        pic_url = wecom_msg.get("PicUrl", "")
        media_id = wecom_msg.get("MediaId", "")
        content = f"[图片] media_id={media_id}" + (f" url={pic_url}" if pic_url else "")
    elif msg_type == "voice":
        media_id = wecom_msg.get("MediaId", "")
        content = f"[语音] media_id={media_id}"
    elif msg_type == "video":
        media_id = wecom_msg.get("MediaId", "")
        content = f"[视频] media_id={media_id}"
    elif msg_type == "file":
        media_id = wecom_msg.get("MediaId", "")
        filename = wecom_msg.get("FileName", "")
        content = f"[文件] {filename} media_id={media_id}"
    elif msg_type == "location":
        lat = wecom_msg.get("Latitude", "")
        lng = wecom_msg.get("Longitude", "")
        label = wecom_msg.get("Label", "")
        content = f"[位置] {label} ({lat},{lng})"
    elif msg_type == "link":
        title = wecom_msg.get("Title", "")
        desc = wecom_msg.get("Description", "")
        url = wecom_msg.get("Url", "")
        content = f"[链接] {title} - {desc}\n{url}"
    else:
        content = f"[{msg_type}] 暂不支持的消息类型"

    # 消息时间 - 转换为ISO格式
    create_time = wecom_msg.get("CreateTime", "")
    msg_time_iso = ""
    if create_time:
        try:
            ts = int(create_time)
            msg_time_iso = datetime.fromtimestamp(ts).isoformat()
        except (ValueError, TypeError):
            msg_time_iso = str(create_time)

    return {
        "msg_id": uuid.uuid4().hex[:32],
        "sender_name": wecom_msg.get("FromUserName", "企业微信用户"),
        "content": content,
        "msg_type": WECOM_MSG_TYPE_MAP.get(msg_type, "text"),
        "msg_time_iso": msg_time_iso,
        "category": "unclassified",
        "tags": [],
    }


# ── 通讯录同步 ────────────────────────────────────────────────

async def sync_contacts(access_token: str) -> dict:
    """同步企业微信通讯录（部门+成员）
    
    返回:
        {"departments": [...], "users": [...], "total": N}
    """
    import httpx
    result = {"departments": [], "users": [], "total": 0}

    try:
        # 获取部门列表
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{WECOM_API_BASE}/department/list?access_token={access_token}"
            )
            data = resp.json()
            if data.get("errcode") == 0:
                result["departments"] = data.get("department", [])
            else:
                logger.warning(f"获取部门列表失败: {data}")

        # 获取成员列表（遍历部门）
        for dept in result["departments"]:
            dept_id = dept.get("id", 1)
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{WECOM_API_BASE}/user/list?access_token={access_token}&department_id={dept_id}"
                )
                data = resp.json()
                if data.get("errcode") == 0:
                    users = data.get("userlist", [])
                    result["users"].extend(users)
                else:
                    logger.debug(f"获取部门{dept_id}成员失败: {data}")

        result["total"] = len(result["users"])
        logger.info(f"同步企业微信通讯录完成: {result['total']} 人, "
                     f"{len(result['departments'])} 部门")
    except Exception as e:
        logger.error(f"同步通讯录异常: {e}")

    return result


async def get_group_chat_info(access_token: str, chat_id: str) -> Optional[dict]:
    """获取企业微信群聊信息"""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{WECOM_API_BASE}/chat/get?access_token={access_token}",
                json={"chatid": chat_id},
            )
            data = resp.json()
            if data.get("errcode") == 0:
                return data.get("chat_info", data)
            logger.warning(f"获取群聊信息失败: {data}")
            return None
    except Exception as e:
        logger.error(f"获取群聊信息异常: {e}")
        return None


# ── 发送应用消息 ──────────────────────────────────────────────

async def send_app_message(access_token: str, agent_id: int,
                           to_user: str, content: str,
                           msg_type: str = "text") -> bool:
    """通过企业微信应用发送消息通知"""
    import httpx
    payload = {
        "touser": to_user,
        "msgtype": msg_type,
        "agentid": agent_id,
    }

    if msg_type == "text":
        payload["text"] = {"content": content}
    elif msg_type == "markdown":
        payload["markdown"] = {"content": content}
    else:
        logger.warning(f"不支持的消息类型: {msg_type}")
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{WECOM_API_BASE}/message/send?access_token={access_token}",
                json=payload,
            )
            data = resp.json()
            if data.get("errcode") == 0:
                logger.info(f"企业微信应用消息发送成功: to={to_user}")
                return True
            else:
                logger.warning(f"发送应用消息失败: {data}")
                return False
    except Exception as e:
        logger.error(f"发送应用消息异常: {e}")
        return False
