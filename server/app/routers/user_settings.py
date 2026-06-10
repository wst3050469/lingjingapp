"""用户设置 / 企业API自管理接口（通过 nginx /api/user-settings 代理暴露）"""
import os
import sys
import logging
import subprocess

from fastapi import APIRouter

logger = logging.getLogger(__name__)

# 获取项目根目录
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DIST_DIR = os.environ.get("DIST_DIR", os.path.join(_PROJECT_ROOT, "dist"))
ADMIN_DIR = os.environ.get("ADMIN_DIR", os.path.join(_PROJECT_ROOT, "admin"))

router = APIRouter(prefix="/api/user-settings", tags=["user-settings"])


@router.get("/health")
async def health():
    """企业API健康检查"""
    return {
        "status": "ok",
        "service": "enterprise-api",
        "version": "1.64.30",
        "dist_exists": os.path.isdir(DIST_DIR) and os.path.exists(os.path.join(DIST_DIR, "index.html")),
        "admin_exists": os.path.isdir(ADMIN_DIR) and os.path.exists(os.path.join(ADMIN_DIR, "index.html")),
    }


@router.post("/deploy")
async def deploy_admin():
    """从dist部署管理后台静态文件到ADMIN_DIR"""
    import shutil

    if not os.path.isdir(DIST_DIR) or not os.path.exists(os.path.join(DIST_DIR, "index.html")):
        return {"status": "error", "message": f"dist目录不存在或无index.html: {DIST_DIR}"}

    os.makedirs(ADMIN_DIR, exist_ok=True)

    try:
        # 清空admin目录
        for item in os.listdir(ADMIN_DIR):
            item_path = os.path.join(ADMIN_DIR, item)
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)

        # 复制dist所有内容
        copied = 0
        for item in os.listdir(DIST_DIR):
            src = os.path.join(DIST_DIR, item)
            dst = os.path.join(ADMIN_DIR, item)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
            copied += 1

        logger.info(f"管理后台部署完成: {copied} 个项目, {len(os.listdir(ADMIN_DIR))} 个文件")
        return {"status": "ok", "message": f"部署完成: {copied} 个项目", "path": ADMIN_DIR}

    except Exception as e:
        logger.error(f"部署失败: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/restart")
async def restart_service():
    """重启enterprise-api服务（通过PM2）"""
    try:
        result = subprocess.run(
            ["pm2", "restart", "enterprise-api"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return {"status": "ok", "message": "enterprise-api 重启中..."}
        else:
            return {"status": "error", "message": result.stderr or result.stdout}
    except Exception as e:
        return {"status": "error", "message": str(e)}
