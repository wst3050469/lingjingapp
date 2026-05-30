"""灵境 - 微信公众号消息同步路由

提供：
1. GET /verify — 微信服务器URL接入验证
2. POST /callback — 接收微信消息推送（文本、图片、语音等）
3. GET /oauth — 微信OAuth2.0授权入口
4. GET /oauth/callback — OAuth授权回调
5. POST /bind — 绑定微信OpenID到灵境用户
6. GET /binding-status — 查询绑定状态
"""
import hashlib
import json
import logging
import os
import time
import sys
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Form, Body
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
import config
from .auth import get_current_user

logger = logging.getLogger("lingjing.wechat_mp_router")
router = APIRouter(prefix="/api/v1/wechat-mp", tags=["wechat-mp"])


# ── 微信配置（支持数据库 + .env 双重来源）──────────────

_db_config_cache = None
_db_config_cache_time = 0


async def _get_wx_config():
    """获取微信公众号配置（优先使用数据库中的配置，回退到 .env）"""
    global _db_config_cache, _db_config_cache_time
    now = time.time()

    # 缓存有效期 60 秒
    if _db_config_cache and now - _db_config_cache_time < 60:
        return _db_config_cache

    appid = os.environ.get("WECHAT_MP_APPID", config.WECHAT_MP_APPID)
    secret = os.environ.get("WECHAT_MP_SECRET", config.WECHAT_MP_SECRET)
    token = os.environ.get("WECHAT_MP_TOKEN", config.WECHAT_MP_TOKEN)

    # 尝试从数据库读取（如果可用）
    try:
        async with database.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT appid, appsecret, token FROM wechat_mp_config LIMIT 1")
            if row:
                db_appid = row["appid"] or ""
                db_secret = row["appsecret"] or ""
                db_token = row["token"] or ""
                if db_appid and db_secret:
                    appid = db_appid
                    secret = db_secret
                    if db_token:
                        token = db_token
    except Exception:
        pass  # fallback to env

    _db_config_cache = (appid, secret, token)
    _db_config_cache_time = now
    return appid, secret, token


async def _is_configured() -> bool:
    """检查微信公众号是否已配置"""
    appid, secret, _ = await _get_wx_config()
    return bool(appid) and bool(secret)


# ── 1. 微信服务器URL接入验证 ─────────────────────────────

@router.get("/verify")
async def verify_server(
    signature: str = Query(""),
    timestamp: str = Query(""),
    nonce: str = Query(""),
    echostr: str = Query(""),
):
    """微信服务器URL接入验证（GET请求）"""
    _, _, token = await _get_wx_config()
    from services.wechat_mp_service import verify_signature
    if verify_signature(token, signature, timestamp, nonce):
        return PlainTextResponse(echostr)
    logger.warning(f"微信接入验证失败: signature={signature}")
    raise HTTPException(403, "签名验证失败")


# ── 2. 接收微信消息推送（同一URL处理GET验证+POST消息）─

@router.get("/callback")
async def wechat_verify(request: Request):
    """微信服务器接入验证（GET）"""
    _, _, token = await _get_wx_config()
    from services.wechat_mp_service import verify_signature

    signature = request.query_params.get("signature", "")
    timestamp = request.query_params.get("timestamp", "")
    nonce = request.query_params.get("nonce", "")
    echostr = request.query_params.get("echostr", "")

    if not verify_signature(token, signature, timestamp, nonce):
        logger.warning(f"微信接入验证失败")
        return PlainTextResponse("signature verification failed", status_code=403)

    return PlainTextResponse(echostr)


@router.post("/callback")
async def wechat_receive_message(request: Request):
    """接收微信服务器推送的消息（POST）"""
    _, _, token = await _get_wx_config()
    from services.wechat_mp_service import (
        verify_signature, parse_xml_message,
        wx_msg_to_wechat_message,
    )

    signature = request.query_params.get("signature", "")
    timestamp = request.query_params.get("timestamp", "")
    nonce = request.query_params.get("nonce", "")
    openid = request.query_params.get("openid", "")

    if not verify_signature(token, signature, timestamp, nonce):
        logger.warning(f"消息签名验证失败: openid={openid}")
        raise HTTPException(403, "签名验证失败")

    # 解析XML消息
    body = await request.body()
    try:
        wx_msg = parse_xml_message(body)
    except Exception as e:
        logger.error(f"XML解析失败: {e}")
        return PlainTextResponse("success")

    msg_type = wx_msg.get("MsgType", "unknown")
    from_user = wx_msg.get("FromUserName", "")
    logger.info(f"收到微信消息: type={msg_type}, from={from_user}")

    # 查找绑定关系
    binding = None
    if from_user:
        async with database.pool.acquire() as conn:
            binding = await conn.fetchrow(
                "SELECT id, tenant_id, user_id FROM wechat_mp_bindings WHERE openid=$1 AND is_bound=true",
                from_user,
            )

    if binding:
        tenant_id = binding["tenant_id"]
        # 转换为灵境消息格式并存储
        group_name = wx_msg.get("FromGroup", "")
        msg_data = wx_msg_to_wechat_message(wx_msg, tenant_id, group_name)

        async with database.pool.acquire() as conn:
            # 1. 存储到 wechat_mp_messages 原始表
            await conn.execute(
                """INSERT INTO wechat_mp_messages
                   (msg_id, openid, tenant_id, msg_type, content,
                    media_id, pic_url, from_group, is_stored)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)""",
                int(wx_msg.get("MsgId", 0)),
                from_user, tenant_id, msg_type,
                msg_data["content"],
                wx_msg.get("MediaId", ""),
                wx_msg.get("PicUrl", ""),
                group_name,
            )

            # 2. 写入 wechat_messages 主表（与手动导入的数据统一）
            # 自动查找或创建群组
            from services.wechat_service import ensure_group
            group_id = await ensure_group(
                conn, tenant_id, group_name or "公众号消息",
                member_count=0,
            )
            from services.wechat_service import save_messages_batch
            await save_messages_batch(conn, group_id, tenant_id, [msg_data])

        logger.info(f"消息已同步: tenant={tenant_id}, group={group_id}")
    else:
        logger.info(f"未绑定的用户: from_user={from_user}，消息暂不存储")

    # 始终回复success（微信不再重试）
    return PlainTextResponse("success")


# ── 3. 微信OAuth2.0授权入口 ────────────────────────────

@router.get("/oauth")
async def oauth_entry(
    redirect: str = Query("/api/v1/wechat-mp/oauth/callback"),
    state: str = Query("wechat_bind"),
):
    """跳转到微信OAuth2.0授权页面"""
    appid, _, _ = await _get_wx_config()
    from services.wechat_mp_service import build_oauth_url
    oauth_url = build_oauth_url(appid, redirect or "", state)
    return RedirectResponse(url=oauth_url)


# ── 4. OAuth授权回调 ────────────────────────────────────

@router.get("/oauth/callback")
async def oauth_callback(
    code: str = Query(""),
    state: str = Query("wechat_bind"),
):
    """微信OAuth2.0授权回调 - 获取openid后展示绑定页面"""
    appid, secret, _ = await _get_wx_config()
    from services.wechat_mp_service import exchange_code_for_openid

    if not code:
        raise HTTPException(400, "缺少授权码")

    openid = await exchange_code_for_openid(appid, secret, code)
    if not openid:
        raise HTTPException(400, "获取OpenID失败")

    # 返回HTML页面，引导用户输入灵境账号完成绑定
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<title>绑定灵境账号</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body {{ font-family: sans-serif; padding: 20px; }}
input {{ width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 6px; }}
button {{ width: 100%; padding: 12px; background: #07C160; color: #fff; border: none; border-radius: 6px; font-size: 16px; }}
.title {{ text-align: center; color: #333; margin-bottom: 24px; }}
.hint {{ color: #999; font-size: 13px; margin: 4px 0 16px; }}
</style>
</head>
<body>
<h3 class="title">🔗 绑定灵境账号</h3>
<p>微信授权成功！请登录您的灵境账号完成绑定。</p>
<form action="/api/v1/wechat-mp/bind" method="post">
<input type="hidden" name="openid" value="{openid}">
<input type="text" name="username" placeholder="灵境用户名" required>
<input type="password" name="password" placeholder="灵境密码" required>
<button type="submit">确认绑定</button>
</form>
<p class="hint">绑定后，您转发到公众号的聊天消息将自动同步到灵境平台</p>
</body>
</html>"""
    return HTMLResponse(content=html)


# ── 5. 绑定微信OpenID到灵境用户 ─────────────────────────

@router.post("/bind")
async def bind_wechat(
    openid: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
):
    """绑定微信OpenID到灵境用户（通过用户名密码验证）"""
    import bcrypt

    if not openid or not username or not password:
        raise HTTPException(422, "缺少必填参数")

    async with database.pool.acquire() as conn:
        # 验证用户凭据
        row = await conn.fetchrow(
            "SELECT id, password_hash, tenant_id, nickname FROM users WHERE username=$1 AND status='active'",
            username,
        )
        if not row:
            raise HTTPException(401, "用户名或密码错误")
        if not bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
            raise HTTPException(401, "用户名或密码错误")

        user_id = str(row["id"])
        tenant_id = row["tenant_id"]
        nickname = row["nickname"] or username

        if not tenant_id:
            raise HTTPException(400, "当前账号未加入企业，无法使用微信同步功能")

        # 检查是否已绑定
        existing = await conn.fetchrow(
            "SELECT id FROM wechat_mp_bindings WHERE openid=$1", openid,
        )
        if existing:
            await conn.execute(
                """UPDATE wechat_mp_bindings
                   SET tenant_id=$1, user_id=$2, nickname=$3, is_bound=true, updated_at=NOW()
                   WHERE openid=$4""",
                tenant_id, user_id, nickname, openid,
            )
        else:
            # 查询是否有unionid
            unionid = ""
            await conn.execute(
                """INSERT INTO wechat_mp_bindings
                   (openid, unionid, tenant_id, user_id, nickname, is_bound)
                   VALUES ($1, $2, $3, $4, $5, true)""",
                openid, unionid, tenant_id, user_id, nickname,
            )

        # 同步未绑定期间收到的消息
        await conn.execute(
            """UPDATE wechat_mp_messages
               SET is_stored=true
               WHERE openid=$1 AND tenant_id='' AND is_stored=false""",
            openid,
        )

    # 返回绑定成功页面
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<title>绑定成功</title>
<style>
body {{ font-family: sans-serif; padding: 40px; text-align: center; }}
.success {{ color: #07C160; font-size: 48px; }}
.msg {{ margin: 20px 0; color: #333; }}
</style>
</head>
<body>
<div class="success">✅</div>
<h3>绑定成功！</h3>
<p class="msg">微信已成功绑定到灵境账号「{nickname}」</p>
<p>现在您可以将微信群聊消息转发到本公众号，系统将自动同步到灵境平台。</p>
<p><small>如需更换账号，请重新扫码绑定。</small></p>
</body>
</html>"""
    return HTMLResponse(content=html)


# ── 6. 查询绑定状态 ─────────────────────────────────────

@router.get("/binding-status")
async def get_binding_status(user: dict = Depends(get_current_user)):
    """查询当前用户的微信绑定状态"""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        return {"bound": False, "openid": None, "msg": "未加入企业"}

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT openid, nickname, created_at, updated_at
               FROM wechat_mp_bindings
               WHERE tenant_id=$1 AND user_id=$2 AND is_bound=true
               ORDER BY updated_at DESC LIMIT 1""",
            tenant_id, str(user.get("user_id", "")),
        )
    if row:
        return {
            "bound": True,
            "openid": row["openid"],
            "nickname": row["nickname"],
            "bound_at": row["created_at"].isoformat() if row["created_at"] else "",
        }
    return {"bound": False, "openid": None, "msg": "未绑定微信，请扫码绑定"}


# ── 7. 微信公众号二维码（前端展示用）────────────────────

@router.get("/qrcode")
async def get_qrcode_url():
    """返回微信公众号二维码图片URL或关注页"""
    appid, _, _ = await _get_wx_config()
    # 返回公众号信息
    return {
        "appid": appid,
        "qrcode_url": f"https://mp.weixin.qq.com/mp/qrcode?scene=1000&appid={appid}",
        "mp_url": f"https://mp.weixin.qq.com/",
        "hint": "请关注公众号后，在公众号菜单中绑定灵境账号",
    }


# ── 8. 获取已同步的消息统计 ─────────────────────────────

@router.get("/synced-stats")
async def get_synced_stats(
    tenant_id: str = Query(""),
    user: dict = Depends(get_current_user),
):
    """获取公众号自动同步的消息统计"""
    from .wechat import _check_tenant_access, _require_wechat_access
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)

    async with database.pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM wechat_mp_messages WHERE tenant_id=$1",
            tenant_id,
        )
        today = await conn.fetchval(
            """SELECT COUNT(*) FROM wechat_mp_messages
               WHERE tenant_id=$1 AND created_at >= NOW() - interval '24 hours'""",
            tenant_id,
        )
        bound_users = await conn.fetchval(
            "SELECT COUNT(*) FROM wechat_mp_bindings WHERE tenant_id=$1 AND is_bound=true",
            tenant_id,
        )
    return {
        "total_synced": total or 0,
        "today_synced": today or 0,
        "bound_users": bound_users or 0,
    }


# ── 9. 公众号配置状态 ────────────────────────────────────

@router.get("/config-status")
async def get_config_status(user: dict = Depends(get_current_user)):
    """检查公众号配置状态（无需密钥信息）"""
    configured = await _is_configured()
    appid, _, _ = await _get_wx_config()
    return {
        "configured": configured,
        "appid": appid[:4] + "****" if appid and len(appid) > 4 else "",
        "msg": "已配置" if configured else "未配置，请联系管理员设置 WECHAT_MP_APPID 和 WECHAT_MP_SECRET",
    }


# ── 10. 模拟微信消息推送（调试用）─────────────────────────

@router.post("/test-push")
async def test_push_message(
    tenant_id: str = Form(...),
    openid: str = Form("test_openid"),
    content: str = Form("这是一条测试消息"),
    group_name: str = Form("测试群聊"),
    user: dict = Depends(get_current_user),
):
    """模拟微信消息推送，用于测试消息同步流程（仅限管理员）"""
    from .wechat import _require_wechat_access, _check_tenant_access
    _require_wechat_access(user)
    _check_tenant_access(user, tenant_id)

    # 构造模拟的微信消息
    from services.wechat_mp_service import wx_msg_to_wechat_message
    from services.wechat_service import ensure_group, save_messages_batch

    mock_wx_msg = {
        "MsgType": "text",
        "FromUserName": openid,
        "ToUserName": "gh_test",
        "Content": content,
        "MsgId": str(int(time.time() * 1000)),
        "CreateTime": str(int(time.time())),
    }

    msg_data = wx_msg_to_wechat_message(mock_wx_msg, tenant_id, group_name)

    async with database.pool.acquire() as conn:
        # 写入原始消息表
        await conn.execute(
            """INSERT INTO wechat_mp_messages
               (msg_id, openid, tenant_id, msg_type, content,
                media_id, pic_url, from_group, is_stored)
               VALUES ($1, $2, $3, $4, $5, '', '', $6, true)""",
            int(mock_wx_msg["MsgId"]), openid, tenant_id,
            "text", content, group_name,
        )

        # 写入主表
        group_id = await ensure_group(conn, tenant_id, group_name, member_count=0)
        result = await save_messages_batch(conn, group_id, tenant_id, [msg_data])

    return {
        "status": "ok",
        "group_id": group_id,
        "group_name": group_name,
        "message": content,
        "inserted": result["inserted"],
        "msg": "测试消息已推送成功，可在群聊列表中查看",
    }


# ── 11. 测试签名验证工具 ─────────────────────────────────

@router.get("/test-verify")
async def test_verify():
    """生成测试用的签名参数（用于微信第三方工具验证）"""
    _, _, token = await _get_wx_config()
    timestamp = str(int(time.time()))
    nonce = "1234567890"
    from services.wechat_mp_service import verify_signature
    # 生成正确签名
    tmp_list = sorted([token, timestamp, nonce])
    tmp_str = "".join(tmp_list)
    import hashlib
    signature = hashlib.sha1(tmp_str.encode()).hexdigest()
    return {
        "url": f"/api/v1/wechat-mp/verify?signature={signature}&timestamp={timestamp}&nonce={nonce}&echostr=OK",
        "signature": signature,
        "timestamp": timestamp,
        "nonce": nonce,
        "token": token,
        "echostr": "OK",
        "hint": "将此URL粘贴到微信公众平台开发-基本配置中的服务器URL验证",
    }


# ── 12. 管理员更新公众号配置 ────────────────────────────

@router.put("/admin-config")
async def update_config(
    data: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """管理员更新微信公众号配置（已脱敏）"""
    from .wechat import _require_wechat_access
    _require_wechat_access(user)

    appid = (data.get("appid") or "").strip()
    appsecret = (data.get("appsecret") or "").strip()
    token = (data.get("token") or "lingjing_wechat_mp_token").strip()

    async with database.pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM wechat_mp_config LIMIT 1")
        if existing:
            # 如果appsecret为空或为掩码值，保留原值
            if appsecret in ("", "******"):
                old = await conn.fetchrow("SELECT appsecret FROM wechat_mp_config WHERE id=$1", existing["id"])
                if old and old["appsecret"]:
                    appsecret = old["appsecret"]
            await conn.execute(
                "UPDATE wechat_mp_config SET appid=$1, appsecret=$2, token=$3, updated_by=$4, updated_at=NOW() WHERE id=$5",
                appid, appsecret, token, user.get("code", ""), existing["id"],
            )
        else:
            await conn.execute(
                "INSERT INTO wechat_mp_config (appid, appsecret, token, updated_by) VALUES ($1, $2, $3, $4)",
                appid, appsecret, token, user.get("code", ""),
            )

    # 清除缓存
    global _db_config_cache
    _db_config_cache = None

    return {
        "code": 0,
        "msg": "公众号配置已更新",
        "appid": appid[:4] + "****" if len(appid) > 4 else appid,
    }


# ── 13. 获取可编辑的配置（脱敏）─────────────────────────

@router.get("/admin-config")
async def get_admin_config(user: dict = Depends(get_current_user)):
    """管理员获取公众号配置（appsecret脱敏）"""
    from .wechat import _require_wechat_access
    _require_wechat_access(user)

    appid = ""
    appsecret_mask = ""
    token = ""

    async with database.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT appid, appsecret, token, updated_at FROM wechat_mp_config LIMIT 1")
        if row:
            appid = row["appid"] or ""
            secret = row["appsecret"] or ""
            appsecret_mask = secret[:4] + "****" + secret[-4:] if len(secret) > 8 else "******"
            token = row["token"] or ""
            updated_at = row["updated_at"]

    return {
        "appid": appid,
        "appsecret": appsecret_mask,
        "token": token,
        "updated_at": updated_at.isoformat() if updated_at else "",
        "configured": bool(appid),
    }


# ── 14. 测试微信服务器连通性 ────────────────────────────

@router.post("/test-connection")
async def test_connection(user: dict = Depends(get_current_user)):
    """测试微信公众号API连通性"""
    from .wechat import _require_wechat_access
    _require_wechat_access(user)

    appid, secret, _ = await _get_wx_config()
    if not appid or not secret:
        return {"ok": False, "msg": "未配置 AppID 或 AppSecret"}

    from services.wechat_mp_service import get_wechat_access_token
    token = await get_wechat_access_token(appid, secret)
    if token:
        return {"ok": True, "msg": "连接成功，access_token 获取正常"}
    else:
        return {"ok": False, "msg": "获取 access_token 失败，请检查 AppID 和 AppSecret"}
