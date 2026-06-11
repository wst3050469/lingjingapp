"""灵境 - 微信公众号集成服务

提供：
1. 微信服务器签名验证（接入验证 + 消息体签名）
2. XML消息解析（文本、图片、语音、链接等）
3. OAuth2.0 网页授权
4. 消息同步到 wechat_messages 表
"""
import hashlib
import json
import logging
import time
import uuid
from xml.etree import ElementTree
from typing import Optional

logger = logging.getLogger("lingjing.wechat_mp")


def verify_signature(token: str, signature: str, timestamp: str, nonce: str) -> bool:
    """验证微信服务器签名（用于URL接入验证 + 消息回调验证）"""
    if not all([token, signature, timestamp, nonce]):
        return False
    tmp_list = sorted([token, timestamp, nonce])
    tmp_str = "".join(tmp_list)
    return hashlib.sha1(tmp_str.encode()).hexdigest() == signature


def parse_xml_message(xml_body: bytes) -> dict:
    """解析微信推送的XML消息为字典"""
    root = ElementTree.fromstring(xml_body)
    msg = {}
    for child in root:
        msg[child.tag] = child.text or ""

    # 解析嵌套的图文消息
    articles = []
    for item in root.iter("item"):
        article = {}
        for child in item:
            article[child.tag] = child.text or ""
        articles.append(article)
    if articles:
        msg["articles"] = articles

    return msg


def build_text_reply(to_user: str, from_user: str, content: str) -> str:
    """构建文本回复XML"""
    return f"""<xml>
<ToUserName><![CDATA[{to_user}]]></ToUserName>
<FromUserName><![CDATA[{from_user}]]></FromUserName>
<CreateTime>{int(time.time())}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[{content}]]></Content>
</xml>"""


def build_success_reply() -> str:
    """回复空串表示success（微信不再重试）"""
    return "success"


# ---------- 消息转换 ----------

def wx_msg_to_wechat_message(wx_msg: dict, tenant_id: str, group_name: str = "") -> dict:
    """将微信公众号推送的消息转换为灵境 wechat_messages 格式"""
    msg_type = wx_msg.get("MsgType", "text")
    content = wx_msg.get("Content", "")

    # 文本消息直接取Content
    # 图片消息：取PicUrl
    if msg_type == "image":
        content = f"[图片] {wx_msg.get('PicUrl', '')}"
    elif msg_type == "voice":
        content = f"[语音] media_id={wx_msg.get('MediaId', '')}"
    elif msg_type == "video":
        content = f"[视频] {wx_msg.get('MediaId', '')}"
    elif msg_type == "link":
        content = f"[链接] {wx_msg.get('Title', '')} - {wx_msg.get('Url', '')}"
    elif msg_type == "location":
        content = f"[位置] {wx_msg.get('Label', '')} ({wx_msg.get('Location_X', '')},{wx_msg.get('Location_Y', '')})"

    return {
        "msg_id": uuid.uuid4().hex[:32],
        "sender_name": wx_msg.get("FromUserName", "微信用户"),
        "content": content,
        "msg_type": msg_type,
        "msg_time": wx_msg.get("CreateTime", int(time.time())),
        "category": "unclassified",
        "tags": [],
    }


# ---------- OAuth2 ----------

def build_oauth_url(appid: str, redirect_uri: str, state: str = "wechat_bind") -> str:
    """构建微信OAuth2.0授权URL（snsapi_base 静默授权）"""
    from urllib.parse import quote
    encoded_uri = quote(redirect_uri, safe="")
    return (
        f"https://open.weixin.qq.com/connect/oauth2/authorize"
        f"?appid={appid}"
        f"&redirect_uri={encoded_uri}"
        f"&response_type=code"
        f"&scope=snsapi_base"
        f"&state={state}"
        f"#wechat_redirect"
    )


async def exchange_code_for_openid(appid: str, secret: str, code: str) -> Optional[str]:
    """通过授权码换取用户的 OpenID"""
    import httpx
    url = (
        f"https://api.weixin.qq.com/sns/oauth2/access_token"
        f"?appid={appid}&secret={secret}&code={code}&grant_type=authorization_code"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()
            if "openid" in data:
                return data["openid"]
            logger.error(f"换取OpenID失败: {data}")
            return None
    except Exception as e:
        logger.error(f"OAuth请求异常: {e}")
        return None


async def get_user_info(access_token: str, openid: str) -> Optional[dict]:
    """获取微信用户基本信息（需snsapi_userinfo scope）"""
    import httpx
    url = f"https://api.weixin.qq.com/sns/userinfo?access_token={access_token}&openid={openid}&lang=zh_CN"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()
            if "nickname" in data:
                return data
            logger.error(f"获取用户信息失败: {data}")
            return None
    except Exception as e:
        logger.error(f"用户信息请求异常: {e}")
        return None


async def get_wechat_access_token(appid: str, secret: str) -> Optional[str]:
    """获取微信公众号全局 access_token（用于消息模板、客服等）"""
    import httpx
    url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={appid}&secret={secret}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()
            if "access_token" in data:
                return data["access_token"]
            logger.error(f"获取access_token失败: {data}")
            return None
    except Exception as e:
        logger.error(f"access_token请求异常: {e}")
        return None
