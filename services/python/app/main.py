"""灵境IDE 主入口"""
import os
import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

# 添加app目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.staticfiles import StaticFiles
from config import UPLOAD_DIR, ADMIN_DIR, DIST_DIR, APK_DIR
import db as database
from routers import auth, user, user_settings, project, task, approval, ai, app_version, memories, chat, profile, files, search, consensus, system, webhook, partners, push, admin, oss, platform_admin, notification, automation, hardware_voice, ha_conversation, call_analysis, voice_asr

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
# 降噪: httpx 在每个 HTTP 请求写 INFO，日志过于冗余
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("启动灵境IDE...")

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
    # 启动个人成长报告调度器 + 背景思考引擎 + 自动同步引擎
    from services.personal_report_service import start_report_scheduler, stop_report_scheduler
    from services.subconscious_engine import start_subconscious_engine, stop_subconscious_engine
    from services.auto_fetch_service import start_auto_fetch, stop_auto_fetch
    _asyncio.create_task(start_report_scheduler())
    start_subconscious_engine()
    start_auto_fetch()
    # 启动视觉模型健康检查
    from services.file_service import start_vision_health_check
    start_vision_health_check()
    yield
    logger.info("关闭灵境IDE...")
    await stop_report_scheduler()
    await stop_subconscious_engine()
    await stop_auto_fetch()
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


app = FastAPI(
    title="灵境 - 企业数字大脑",
    description="基于AI的企业管理系统",
    version="1.72.16",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(user.router)
app.include_router(user_settings.router)
app.include_router(project.router)
app.include_router(task.router)
app.include_router(approval.router)
app.include_router(app_version.router)
app.include_router(memories.router)
app.include_router(chat.router)
app.include_router(profile.router)
app.include_router(files.router)
app.include_router(admin.router)
app.include_router(search.router)
app.include_router(consensus.router)
app.include_router(system.router)
app.include_router(platform_admin.router)
app.include_router(webhook.router)
app.include_router(partners.router)
app.include_router(push.router)
app.include_router(oss.router)
app.include_router(notification.router)
app.include_router(automation.router)
app.include_router(hardware_voice.router)
app.include_router(ha_conversation.router)
app.include_router(call_analysis.router)
app.include_router(voice_asr.router)

# 静态文件服务 - 上传的文件
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# 管理后台静态页面 - 自动从dist部署
os.makedirs(ADMIN_DIR, exist_ok=True)
if os.path.isdir(DIST_DIR) and os.path.exists(os.path.join(DIST_DIR, 'index.html')):
    # 自动部署: 将Expo构建的dist目录内容同步到ADMIN_DIR
    import shutil
    if not os.path.exists(os.path.join(ADMIN_DIR, 'index.html')) or os.path.getmtime(os.path.join(DIST_DIR, 'index.html')) > os.path.getmtime(os.path.join(ADMIN_DIR, 'index.html')):
        logger.info(f"自动部署管理后台: {DIST_DIR} -> {ADMIN_DIR}")
        # 清空admin目录（保留目录本身）
        for item in os.listdir(ADMIN_DIR):
            item_path = os.path.join(ADMIN_DIR, item)
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
        # 复制dist所有内容
        for item in os.listdir(DIST_DIR):
            src = os.path.join(DIST_DIR, item)
            dst = os.path.join(ADMIN_DIR, item)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
        logger.info(f"管理后台部署完成: {len(os.listdir(ADMIN_DIR))} 个文件")
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
    return {"status": "healthy", "service": "灵境IDE"}


@app.get("/")
async def root():
    return {"name": "灵境IDE", "version": "1.72.16"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8900)
