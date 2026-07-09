"""灵境 - 企业数字大脑 主入口"""
import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# 添加app目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.staticfiles import StaticFiles

# 容错导入 — 生产环境可能缺少部分模块
def _safe_import(module_name: str):
    """尝试导入模块，失败时返回 None 并记录警告"""
    try:
        return __import__(f"routers.{module_name}", fromlist=[module_name])
    except Exception as e:
        logging.getLogger(__name__).warning(f"模块 routers.{module_name} 导入失败（功能将不可用）: {e}")
        return None

# 核心模块 (必须存在)
from routers import auth, user, project, task, approval, ai, app_version
from routers import memories, chat, profile, files, search

# 可选模块 — 导入失败不影响启动
admin = _safe_import("admin")
oss = _safe_import("oss")
platform_admin = _safe_import("platform_admin")
notification = _safe_import("notification")
automation = _safe_import("automation")
hardware_voice = _safe_import("hardware_voice")
dashboard = _safe_import("dashboard")
ha_conversation = _safe_import("ha_conversation")
import_data = _safe_import("import_data")
call_analysis = _safe_import("call_analysis")
voice_asr = _safe_import("voice_asr")
wechat = _safe_import("wechat")
wechat_mp = _safe_import("wechat_mp")
wecom = _safe_import("wecom")
tenant_admin = _safe_import("tenant_admin")
technician = _safe_import("technician")
business = _safe_import("business")
consensus = _safe_import("consensus")
system = _safe_import("system")
webhook = _safe_import("webhook")
partners = _safe_import("partners")
push = _safe_import("push")
import db as database
from config import UPLOAD_DIR, ADMIN_DIR, APK_DIR

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
# 降噪: httpx 在每个 HTTP 请求写 INFO，日志过于冗余
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# 后台服务引用（在 lifespan 中初始化/清理）
_service_stoppers: dict = {}

def _start_service(_asyncio, svc_name: str, label: str):
    """安全启动后台服务 — 缺失不影响主流程"""
    try:
        mod = __import__(f"services.{svc_name}", fromlist=["start", "stop"])
        starter = getattr(mod, f"start_{svc_name}", None)
        stopper = getattr(mod, f"stop_{svc_name}", None)
        if starter:
            _asyncio.create_task(starter())
        if stopper:
            _service_stoppers[label] = stopper
    except Exception as e:
        logger.info(f"{label}引擎未加载: {e}")

def _start_service_sync(svc_name: str, label: str):
    """安全启动同步后台服务 — 缺失不影响主流程"""
    try:
        mod = __import__(f"services.{svc_name}", fromlist=["start", "stop"])
        starter = getattr(mod, f"start_{svc_name}", None)
        stopper = getattr(mod, f"stop_{svc_name}", None)
        if starter:
            starter()
        if stopper:
            _service_stoppers[label] = stopper
    except Exception as e:
        logger.info(f"{label}引擎未加载: {e}")

async def _stop_service(svc_name: str, label: str):
    """安全停止后台服务"""
    stopper = _service_stoppers.pop(label, None)
    if stopper:
        try:
            await stopper()
        except Exception as e:
            logger.warning(f"停止{label}引擎失败: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("启动灵境企业管理系统...")

    # 启动前关键配置检查
    import config
    missing = []
    if not config.DATABASE_URL:
        missing.append("DATABASE_URL")
    if not config.DEEPSEEK_API_KEY:
        missing.append("DEEPSEEK_API_KEY")
    if missing:
        logger.critical(f"缺少关键配置: {', '.join(missing)}，请在 .env 中设置")
        raise RuntimeError(f"缺少关键配置: {', '.join(missing)}")

    await database.init_db()
    logger.info("数据库连接已建立")
    # 预加载 Whisper 模型 + Ollama 模型（后台运行，不阻塞启动）
    import asyncio as _asyncio
    _asyncio.create_task(_preload_whisper())
    _asyncio.create_task(_preload_ollama())
    _asyncio.create_task(_preload_tts())
    # 启动可选的后台服务引擎 — 缺失不影响核心功能
    _start_service(_asyncio, "ai_reminder", "AI主动提醒")
    _start_service(_asyncio, "automation_engine", "自动化任务")
    _start_service(_asyncio, "personal_report_service", "个人报告")
    _start_service_sync("subconscious_engine", "背景思考")
    _start_service_sync("auto_fetch_service", "自动同步")
    # 启动视觉模型健康检查
    try:
        from services.file_service import start_vision_health_check
        start_vision_health_check()
    except Exception as e:
        logger.info(f"视觉健康检查未加载: {e}")
    yield
    logger.info("关闭灵境企业管理系统...")
    await _stop_service("ai_reminder", "AI主动提醒")
    await _stop_service("automation_engine", "自动化任务")
    await _stop_service("personal_report_service", "个人报告")
    await _stop_service("subconscious_engine", "背景思考")
    await _stop_service("auto_fetch_service", "自动同步")
    await database.close_db()


async def _preload_whisper():
    """预加载 Whisper 模型 (线程池, 不阻塞事件循环)"""
    try:
        from services.transcribe import preload_model
        logger.info("预加载 Whisper 语音识别模型 (后台线程池)...")
        await preload_model()
    except Exception as e:
        logger.warning(f"Whisper 模型预加载失败: {e}（语音功能首次使用时将重试加载）")


async def _preload_ollama():
    """预加载 Ollama gemma4:26b 到显存，避免首次调用时冷启动（~7s延迟）"""
    try:
        import config
        if not config.OLLAMA_CHAT_ENABLED:
            logger.info("Ollama 未启用，跳过预热")
            return
        logger.info(f"预热 Ollama {config.OLLAMA_CHAT_MODEL} 模型...")
        import httpx
        t0 = __import__("time").time()
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                f"{config.OLLAMA_CHAT_URL}/api/chat",
                json={
                    "model": config.OLLAMA_CHAT_MODEL,
                    "messages": [{"role": "user", "content": "ping"}],
                    "stream": False,
                    "keep_alive": -1,
                    "think": False,
                    "options": {"num_predict": 1, "temperature": 0},
                },
            )
        elapsed = __import__("time").time() - t0
        if resp.status_code == 200:
            logger.info(f"Ollama {config.OLLAMA_CHAT_MODEL} 预热完成 ✓ ({elapsed:.1f}s)")
        else:
            logger.warning(f"Ollama 预热返回 {resp.status_code}: {resp.text[:100]}")
    except Exception as e:
        logger.warning(f"Ollama 模型预热失败: {e}（首次聊天可能较慢）")


async def _preload_tts():
    """预合成TTS高频短语到缓存"""
    try:
        from services.tts_service import warmup_tts_cache
        await warmup_tts_cache()
    except Exception as e:
        logger.warning(f"TTS 缓存预热失败: {e}")


# 自动读取根目录 package.json 获取版本号，保持与桌面端一致
def _read_version() -> str:
    try:
        import json
        root_pkg = Path(__file__).resolve().parent.parent.parent / "package.json"
        if root_pkg.exists():
            return json.loads(root_pkg.read_text(encoding="utf-8")).get("version", "0.0.0")
    except Exception:
        pass
    return "0.0.0"

APP_VERSION = _read_version()

# CORS 白名单 — 仅允许已知域名
CORS_ORIGINS = [
    o.strip() for o in os.environ.get(
        "CORS_ORIGINS",
        "https://www.spiritrealmz.com,https://lingjing.zhejiangjinmo.com,https://wap.zhejiangjinmo.com"
    ).split(",") if o.strip()
]

app = FastAPI(
    title="灵境 - 企业数字大脑",
    description="基于AI的企业管理系统",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "x-api-key", "x-request-id"],
)

# ── 管理后台 SPA fallback ──
# 当 /admin/* 路径返回 404 时，尝试返回 SPA 的 index.html
_ADMIN_DIR = ADMIN_DIR  # 供异常处理器使用
@app.exception_handler(404)
async def admin_spa_404_handler(request, exc):
    if request.url.path.startswith("/admin/") or request.url.path == "/admin":
        index_path = os.path.join(_ADMIN_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path, media_type="text/html")
    return JSONResponse({"detail": "Not Found"}, status_code=404)

# 安全的 include_router — 跳过未加载的模块
def _safe_include_router(mod, name: str):
    if mod is not None and hasattr(mod, 'router'):
        app.include_router(mod.router)
    elif mod is None:
        logger.info(f"路由 {name} 未加载（模块缺失），跳过")

# 注册路由
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(user.router)
app.include_router(project.router)

app.include_router(task.router)
app.include_router(approval.router)
app.include_router(app_version.router)
app.include_router(memories.router)
app.include_router(chat.router)
app.include_router(profile.router)
app.include_router(files.router)
_safe_include_router(tenant_admin, "tenant_admin")
_safe_include_router(admin, "admin")
app.include_router(search.router)
_safe_include_router(technician, "technician")
_safe_include_router(business, "business")
_safe_include_router(consensus, "consensus")
_safe_include_router(system, "system")
_safe_include_router(platform_admin, "platform_admin")
_safe_include_router(webhook, "webhook")
_safe_include_router(partners, "partners")
_safe_include_router(push, "push")
_safe_include_router(oss, "oss")
_safe_include_router(notification, "notification")
_safe_include_router(automation, "automation")
_safe_include_router(hardware_voice, "hardware_voice")
_safe_include_router(dashboard, "dashboard")
_safe_include_router(ha_conversation, "ha_conversation")
_safe_include_router(import_data, "import_data")
_safe_include_router(call_analysis, "call_analysis")
_safe_include_router(voice_asr, "voice_asr")
_safe_include_router(wechat, "wechat")
_safe_include_router(wechat_mp, "wechat_mp")
_safe_include_router(wecom, "wecom")

# 静态文件服务 - 上传的文件
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# 管理后台静态页面 — 先用 StaticFiles 挂载，再通过异常处理做 SPA fallback
os.makedirs(ADMIN_DIR, exist_ok=True)
app.mount("/admin", StaticFiles(directory=ADMIN_DIR, html=True), name="admin")

# APK 下载直链 - StaticFiles 比 FileResponse 快很多
os.makedirs(APK_DIR, exist_ok=True)
app.mount("/apk", StaticFiles(directory=APK_DIR), name="apk")

@app.websocket("/api/v1/ws/{token}")
async def ws_endpoint(websocket: WebSocket, token: str):
    """WebSocket 推送端点 - 直接注册到 app（必须最先匹配）"""
    from routers.ws_push import handle_ws
    await handle_ws(websocket, token)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "灵境企业管理系统", "version": APP_VERSION}

@app.get("/WW_verify_xteLOMYFbau0PLmR.txt")

async def wecom_verify():

    from fastapi.responses import PlainTextResponse

    return PlainTextResponse("xteLOMYFbau0PLmR")

    
@app.get("/")
async def root():
    return {"name": "灵境 - 企业数字大脑", "version": APP_VERSION}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8900)
