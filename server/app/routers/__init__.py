# Routers package - minimal imports to avoid circular dependencies
# main.py imports all 32+ routers directly as submodules
from . import auth, user, project, task, approval, ai, app_version

__all__ = [
    "auth", "user", "project", "task", "approval", "ai", "app_version",
    # Additional routers imported directly by main.py:
    # memories, chat, profile, files, tenant_admin, search,
    # technician, business, consensus, system, webhook, partners,
    # push, admin, oss, platform_admin, notification, automation,
    # hardware_voice, dashboard, ha_conversation, import_data,
    # call_analysis, voice_asr, wechat, wechat_mp, wecom, ws_push,
]
