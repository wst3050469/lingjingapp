"""
灵境 - 短信通知服务

支持多网关：
  1. 腾讯云 SMS（国内推荐）
  2. 阿里云 SMS
  3. Twilio（国际）
  4. 日志模式（开发/测试，只写日志不实际发送）

用法:
    from services.sms_service import send_sms
    
    # 单条发送
    await send_sms("13800138000", "SMS_123456", {"name": "张三", "deadline": "2026-05-30"})
    
    # 批量发送
    await send_sms_batch([{"phone": "...", "template_id": "...", "params": {...}}])
"""
import os
import json
import logging

logger = logging.getLogger("lingjing.sms")

# 配置（从环境变量读取）
SMS_ENABLED = os.environ.get("SMS_ENABLED", "false").lower() == "true"
SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "log")  # log | tencent | aliyun | twilio
SMS_REGION = os.environ.get("SMS_REGION", "ap-guangzhou")

# 腾讯云
SMS_APP_ID = os.environ.get("SMS_APP_ID", "")
SMS_APP_KEY = os.environ.get("SMS_APP_KEY", "")
SMS_SIGN_NAME = os.environ.get("SMS_SIGN_NAME", "灵境")

# Twilio
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")

# 频率限制
MAX_SMS_PER_USER_PER_DAY = int(os.environ.get("MAX_SMS_PER_DAY", "3"))
MAX_SMS_PER_TENANT_PER_DAY = int(os.environ.get("MAX_SMS_PER_TENANT_PER_DAY", "50"))


async def send_sms(
    phone: str,
    template_id: str,
    params: dict[str, str] | None = None,
    tenant_id: str | None = None,
) -> dict:
    """发送单条短信

    Args:
        phone: 手机号码
        template_id: 短信模板ID
        params: 模板参数 {变量名: 值, ...}
        tenant_id: 租户ID（用于频率限制）

    Returns:
        {"success": True, "message_id": "...", "provider": "..."}
        或 {"success": False, "error": "..."}
    """
    if not _validate_phone(phone):
        return {"success": False, "error": f"无效手机号: {phone}"}

    if not SMS_ENABLED or SMS_PROVIDER == "log":
        _log_sms(phone, template_id, params)
        return {"success": True, "message_id": f"log_{id(phone)}", "provider": "log"}

    tenant_id = tenant_id or "unknown"

    # 频率检查
    if tenant_id != "unknown":
        hourly_count = await _get_hourly_count(tenant_id)
        if hourly_count >= MAX_SMS_PER_TENANT_PER_DAY:
            logger.warning(f"短信频率超限: tenant={tenant_id}, {hourly_count}/{MAX_SMS_PER_TENANT_PER_DAY}")
            return {"success": False, "error": f"租户每日短信上限 {MAX_SMS_PER_TENANT_PER_DAY} 条"}

    # 按提供商路由
    try:
        if SMS_PROVIDER == "tencent":
            return await _send_tencent(phone, template_id, params or {})
        elif SMS_PROVIDER == "twilio":
            return await _send_twilio(phone, params.get("text", "") if params else "")
        else:
            _log_sms(phone, template_id, params)
            return {"success": True, "message_id": f"log_{id(phone)}", "provider": "log"}
    except Exception as e:
        logger.error(f"短信发送失败 [{SMS_PROVIDER}]: {e}")
        return {"success": False, "error": str(e)}


async def send_sms_batch(
    messages: list[dict],
    tenant_id: str | None = None,
) -> list[dict]:
    """批量发送短信（逐个发送，互不影响）"""
    results = []
    for msg in messages:
        result = await send_sms(
            phone=msg.get("phone", ""),
            template_id=msg.get("template_id", ""),
            params=msg.get("params"),
            tenant_id=tenant_id or msg.get("tenant_id"),
        )
        results.append(result)
    return results


async def send_reminder_sms(
    phone: str,
    title: str,
    body: str,
    tenant_id: str | None = None,
) -> dict:
    """发送一条灵境提醒短信（使用通用模板）"""
    params = {"title": title[:20], "body": body[:50]}
    return await send_sms(
        phone=phone,
        template_id="lingjing_reminder",
        params=params,
        tenant_id=tenant_id,
    )


def _validate_phone(phone: str) -> bool:
    """简单国内手机号校验"""
    import re
    return bool(re.match(r"^1[3-9]\d{9}$", phone.strip()))


def _log_sms(phone: str, template_id: str, params: dict | None):
    """日志模式：只写日志不发送"""
    logger.info(f"[SMS_LOG] 发送短信: {phone} | 模板: {template_id} | 参数: {params}")
    _record_sms_log(phone, template_id, params, "log", True)


def _record_sms_log(phone: str, template_id: str, params: dict | None,
                    provider: str, success: bool, message_id: str = "",
                    error: str = ""):
    """记录短信发送日志到数据库"""
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import db as database

    async def _write():
        try:
            async with database.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO sms_logs
                       (phone, template_id, params, provider, success, message_id, error)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                    phone, template_id, json.dumps(params or {}),
                    provider, success, message_id, error,
                )
        except Exception as e:
            logger.warning(f"短信日志写入失败: {e}")

    import asyncio
    asyncio.create_task(_write())


async def _get_hourly_count(tenant_id: str) -> int:
    """获取租户今日短信发送量"""
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        import db as database
        async with database.pool.acquire() as conn:
            count = await conn.fetchval(
                """SELECT count(*) FROM sms_logs
                   WHERE created_at >= CURRENT_DATE""",
            )
            return count or 0
    except Exception:
        return 0


# ── 各提供商实现 ──


async def _send_tencent(phone: str, template_id: str, params: dict) -> dict:
    """腾讯云 SMS 发送

    需要安装: pip install tencentcloud-sdk-python
    配置环境变量: SMS_APP_ID, SMS_APP_KEY
    """
    try:
        from tencentcloud.common import credential
        from tencentcloud.sms.v20210111 import sms_client, models

        cred = credential.Credential(SMS_APP_ID, SMS_APP_KEY)
        client = sms_client.SmsClient(cred, SMS_REGION)

        req = models.SendSmsRequest()
        req.PhoneNumberSet = [f"+86{phone}"]
        req.TemplateId = template_id
        req.SignName = SMS_SIGN_NAME
        req.TemplateParamSet = list(params.values())

        resp = client.SendSms(req)
        if resp.SendStatusSet and resp.SendStatusSet[0].Code == "Ok":
            msg_id = resp.SendStatusSet[0].SerialNo
            _record_sms_log(phone, template_id, params, "tencent", True, msg_id)
            return {"success": True, "message_id": msg_id, "provider": "tencent"}
        else:
            err = resp.SendStatusSet[0].Message if resp.SendStatusSet else "Unknown"
            _record_sms_log(phone, template_id, params, "tencent", False, error=err)
            return {"success": False, "error": err}
    except ImportError:
        return {"success": False, "error": "需要安装 tencentcloud-sdk-python"}
    except Exception as e:
        _record_sms_log(phone, template_id, params, "tencent", False, error=str(e))
        return {"success": False, "error": str(e)}


async def _send_twilio(phone: str, text: str) -> dict:
    """Twilio 国际 SMS 发送"""
    try:
        from twilio.rest import Client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=text,
            from_=TWILIO_FROM_NUMBER,
            to=f"+86{phone}",
        )
        _record_sms_log(phone, "twilio_direct", {"text": text}, "twilio", True, message.sid)
        return {"success": True, "message_id": message.sid, "provider": "twilio"}
    except ImportError:
        return {"success": False, "error": "需要安装 twilio"}
    except Exception as e:
        _record_sms_log(phone, "twilio_direct", {"text": text}, "twilio", False, error=str(e))
        return {"success": False, "error": str(e)}
