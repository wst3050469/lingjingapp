"""灵境配置"""
import os
from pathlib import Path

# 自动加载 .env 文件（systemd 注入的变量优先，不会被覆盖）
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path, override=False)
except ImportError:
    pass  # python-dotenv 未安装时静默跳过

DATABASE_URL = os.environ.get("DATABASE_URL", "")

API_HOST = "0.0.0.0"
API_PORT = 8900

# DeepSeek API配置（密钥必须在 .env 中设置）
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")

# Ollama Embedding配置
OLLAMA_PRIMARY = os.environ.get("OLLAMA_PRIMARY", "http://127.0.0.1:11434")
OLLAMA_SECONDARY = os.environ.get("OLLAMA_SECONDARY", "http://192.168.1.10:11434")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "bge-m3")  # bge-m3: 1024维, 多语言(C-E)最优
EMBED_MAX_CONCURRENT = 5  # 最大并发embedding请求数

# Ollama 本地LLM聊天配置
OLLAMA_CHAT_URL = os.environ.get("OLLAMA_CHAT_URL", "http://127.0.0.1:11434")
OLLAMA_CHAT_MODEL = os.environ.get("OLLAMA_CHAT_MODEL", "gemma4:26b")
OLLAMA_CHAT_ENABLED = os.environ.get("OLLAMA_CHAT_ENABLED", "true").lower() in ("1", "true", "yes")
OLLAMA_CHAT_TIMEOUT = int(os.environ.get("OLLAMA_CHAT_TIMEOUT", "300"))  # 本地模型首次加载需要时间
# 默认聊天模型: "ollama"=本地gemma4, None=DeepSeek
DEFAULT_CHAT_MODEL = os.environ.get("DEFAULT_CHAT_MODEL", "deepseek")  # ollama 或 deepseek

# 文件上传配置（默认基于项目根目录）
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", str(_PROJECT_ROOT / "uploads"))
TEMP_DIR = os.environ.get("TEMP_DIR", str(_PROJECT_ROOT / "uploads" / "_temp"))  # OSS 下载临时目录
ADMIN_DIR = os.environ.get("ADMIN_DIR", str(_PROJECT_ROOT / "admin"))
DIST_DIR = os.environ.get("DIST_DIR", str(_PROJECT_ROOT / "dist"))
APK_DIR = os.environ.get("APK_DIR", str(_PROJECT_ROOT / "app"))
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB
MAX_DOC_SIZE = 20 * 1024 * 1024     # 20MB
MAX_VIDEO_SIZE = 200 * 1024 * 1024  # 200MB
MAX_DRAWING_SIZE = 50 * 1024 * 1024 # 50MB（图纸文件较大）
MAX_EXTRACT_CHARS = 5000

# 支持的文件类型
ALLOWED_IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}
ALLOWED_DOC_EXT = {'.pdf', '.doc', '.docx', '.xls', '.xlsx'}
ALLOWED_TXT_EXT = {'.txt'}
ALLOWED_DRAWING_EXT = {'.dwg', '.dxf'}
ALLOWED_VIDEO_EXT = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp'}
ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXT | ALLOWED_DOC_EXT | ALLOWED_TXT_EXT | ALLOWED_DRAWING_EXT | ALLOWED_VIDEO_EXT

# 阿里云 OSS 配置
OSS_ACCESS_KEY_ID = os.environ.get("OSS_ACCESS_KEY_ID", "")
OSS_ACCESS_KEY_SECRET = os.environ.get("OSS_ACCESS_KEY_SECRET", "")
OSS_BUCKET_NAME = os.environ.get("OSS_BUCKET_NAME", "lingjingoss")
OSS_ENDPOINT = os.environ.get("OSS_ENDPOINT", "oss-cn-hongkong.aliyuncs.com")
OSS_CDN_BASE = os.environ.get("OSS_CDN_BASE", "https://lingjing.zhejiangjinmo.com")  # CDN 加速域名
OSS_ROLE_ARN = os.environ.get("OSS_ROLE_ARN", "")  # RAM 角色 ARN（STS 用）
OSS_STS_TOKEN_EXPIRE = 3600  # STS 临时凭证有效期（秒）
OSS_UPLOAD_PREFIX = "uploads/"  # 上传文件在 OSS 中的路径前缀

# Ollama 视觉模型配置（图片分析）
# moondream: 轻量多模态模型(1.8B)，支持图片描述和OCR
# gemma4 系为纯文本模型，不支持视觉输入
VISION_MODEL = os.environ.get("VISION_MODEL", "moondream:latest")
VISION_FALLBACK_MODELS = ["moondream:latest"]  # 本地备用模型
VISION_REMOTE_MODELS = ["moondream:latest"]  # 远程模型
VISION_TIMEOUT = 120

# 成本告警阈值（元）
COST_ALERT_DAILY = float(os.environ.get("COST_ALERT_DAILY", "5.0"))
COST_ALERT_MONTHLY_WARN = float(os.environ.get("COST_ALERT_MONTHLY_WARN", "50.0"))
COST_ALERT_MONTHLY_CRITICAL = float(os.environ.get("COST_ALERT_MONTHLY_CRITICAL", "100.0"))

# 智能模型路由配置 (Model Router)
# 覆盖默认路由表，格式: {"hint_name": ("provider", "model_name")}
# provider: "deepseek" | "ollama"
# model_name: deepseek 模型名 或 ollama 模型名
MODEL_ROUTES = {
    "reasoning":  ("deepseek", os.environ.get("MODEL_REASONING", "deepseek-chat")),
    "fast":       ("ollama",   os.environ.get("MODEL_FAST", "gemma4:latest")),
    "vision":     ("ollama",   os.environ.get("MODEL_VISION", "moondream:latest")),
    "summary":    ("deepseek", os.environ.get("MODEL_SUMMARY", "deepseek-chat")),
    "code":       ("deepseek", os.environ.get("MODEL_CODE", "deepseek-chat")),
    "default":    ("deepseek", os.environ.get("MODEL_DEFAULT", "deepseek-chat")),
}

# 短信通知配置
SMS_ENABLED = os.environ.get("SMS_ENABLED", "false").lower() in ("1", "true", "yes")
SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "log")  # log | tencent | aliyun | twilio
SMS_APP_ID = os.environ.get("SMS_APP_ID", "")
SMS_APP_KEY = os.environ.get("SMS_APP_KEY", "")
SMS_SIGN_NAME = os.environ.get("SMS_SIGN_NAME", "灵境")
MAX_SMS_PER_DAY = int(os.environ.get("MAX_SMS_PER_DAY", "3"))

# 微信公众号配置（用于自动同步聊天消息）
WECHAT_MP_APPID = os.environ.get("WECHAT_MP_APPID", "")
WECHAT_MP_SECRET = os.environ.get("WECHAT_MP_SECRET", "")
WECHAT_MP_TOKEN = os.environ.get("WECHAT_MP_TOKEN", "lingjing_wechat_mp_token")
WECHAT_MP_ENCODING_AES_KEY = os.environ.get("WECHAT_MP_ENCODING_AES_KEY", "")

# 企业微信配置（用于企业微信聊天消息自动同步）
WECOM_CORP_ID = os.environ.get("WECOM_CORP_ID", "")
WECOM_AGENT_ID = int(os.environ.get("WECOM_AGENT_ID", "0"))
WECOM_AGENT_SECRET = os.environ.get("WECOM_AGENT_SECRET", "")
WECOM_CALLBACK_TOKEN = os.environ.get("WECOM_CALLBACK_TOKEN", "")
WECOM_CALLBACK_AES_KEY = os.environ.get("WECOM_CALLBACK_AES_KEY", "")
WECOM_API_BASE = "https://qyapi.weixin.qq.com/cgi-bin"
