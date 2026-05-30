"""灵境平台 - APP版本公共API（无需认证）"""
import os
import re
import logging
from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as database
import config

logger = logging.getLogger("lingjing.app_version")

router = APIRouter(prefix="/api/v1/app", tags=["app"])

# APK文件目录 - 优先使用环境变量，否则使用config中的路径
_APK_DIR = Path(os.getenv("APK_DIR", config.APK_DIR))
_LAN_HOST = os.getenv("LAN_HOST", "192.168.1.10")
_LAN_PORT = os.getenv("API_PORT", "8900")

# 公网下载基础URL
# 主用: lingjing.zhejiangjinmo.com → 阿里云CDN → 本地nginx (ECS:8900)
# 注意: OSS账号已禁用(UserDisable)，所有OSS/CDN海外通道均不可用
_PUBLIC_DOWNLOAD_BASE = "https://lingjing.zhejiangjinmo.com"
# 本地nginx直接服务（通过API下载端点，绕过CDN缓存不一致问题）
_API_DOWNLOAD_BASE = "https://lingjing.zhejiangjinmo.com/api/v1/app/download"
# 香港服务器（文件serve等其他用途仍在使用，不删除常量声明）
_HK_BASE = "https://www.spiritrealmz.com"
# ⚠️ _HK_BASE 不再用于APK下载：spiritrealmz.com→SSH隧道→uvicorn，uvicorn无/apk/路由→404


def _normalize_apk_filename(filename: str) -> str:
    """归一化APK文件名：中文'灵境-' → 英文'lingjing-'，统一CDN路径"""
    if not filename:
        return filename
    # 替换中文'灵境-'为英文'lingjing-'
    normalized = re.sub(r'^灵境-', 'lingjing-', filename)
    # 替换中文'灵境_v'为英文'lingjing_v'
    normalized = re.sub(r'^灵境_v', 'lingjing_v', normalized)
    return normalized


def _apk_to_download_filename(apk_fn: str) -> str:
    """将 .apk 扩展名替换为 .download（绕过阿里云OSS对APK文件的封锁）
       ⚠️ 已废弃：OSS AK/SK被禁用(UserDisable)，仅保留兼容旧代码"""
    if apk_fn.endswith('.apk'):
        return apk_fn[:-4] + '.download'
    return apk_fn + '.download'


@router.get("/check-update")
async def check_update(version_code: int = 0, current_code: int = 0):
    # 兼容旧版Flutter APP使用current_code参数名
    if version_code == 0 and current_code > 0:
        version_code = current_code
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT id, version_name, version_code, release_notes,
                      apk_filename, apk_size, is_force_update
               FROM app_versions
               WHERE status='published' AND version_code > $1
               ORDER BY version_code DESC LIMIT 1""",
            version_code,
        )
    if not row:
        return {"has_update": False}
    ver = row["version_name"]
    apk_fn = _normalize_apk_filename(row["apk_filename"])

    # 下载URL优先级（Flutter端按字段名顺序尝试）:
    #   1. lan_url      = LAN直连（最快，限同网络）
    #   2. download_url = API本地下载端点（通过nginx HTTPS转发，确保最新版本）
    #   3. cdn_url      = CDN域名（阿里云CDN，可能缓存旧版，作为兜底）
    #   ⚠️ OSS直连通道已废弃（AK/SK被禁用，HTTP 403）
    download_url = f"{_API_DOWNLOAD_BASE}/{ver}"
    # LAN直连 (同网络时极快)
    lan_url = f"http://{_LAN_HOST}:{_LAN_PORT}/api/v1/app/download/{ver}"
    # CDN域名兜底 — CDN回源到本地nginx静态文件(/api/v1/app/apk/路径)
    # v1.64.1修复记录: CDN公网通道已恢复(实测X-Cache: HIT, 10MB/s)
    # 务必使用lingjing CDN域名（nginx有/apk/静态路由），不能用HK域名（uvicorn无此路由→404）
    cdn_url = f"{_PUBLIC_DOWNLOAD_BASE}/api/v1/app/apk/{apk_fn}"

    return {
        "has_update": True,
        "version": {
            "version_name": ver,
            "version_code": row["version_code"],
            "release_notes": row["release_notes"],
            "is_force_update": row["is_force_update"],
            # 向后兼容：旧版APP(v1.30.0及更早)的update_service.dart存在Bug
            # 会将apk_size乘以1024*1024（误以为API返回MB），导致targetSize=40TB
            # 校验永远失败。对旧版APP返回缩小后的值，让乘算后≈36MB，校验通过。
            "apk_size": 36 if version_code < 13001 else row["apk_size"],
            "apk_filename": apk_fn,
            "download_url": download_url,
            "cdn_url": cdn_url,
            "lan_url": lan_url,
        },
    }


@router.get("/download/{version_name}")
async def download_version(version_name: str, request: Request = None):
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, apk_filename FROM app_versions WHERE version_name=$1 AND status IN ('published','archived','pending_review')",
            version_name,
        )
        if not row:
            return {"error": "版本不存在或未发布"}
        await conn.execute(
            "UPDATE app_versions SET download_count = download_count + 1 WHERE id=$1",
            row["id"],
        )
    apk_fn = _normalize_apk_filename(row["apk_filename"])
    local_path = _APK_DIR / apk_fn
    # 公网重定向到CDN域名(lingjing.zhejiangjinmo.com)，CDN回源本地nginx静态文件直出
    # 之前的HK重定向(spiritrealmz.com)经SSH隧道到uvicorn → uvicorn无/apk/路由→404
    public_url = f"{_PUBLIC_DOWNLOAD_BASE}/api/v1/app/apk/{apk_fn}"
    
    if not local_path.exists():
        logger.warning(f"本地APK不存在: {local_path}，走公网通道: {public_url}")
        return RedirectResponse(url=public_url, status_code=302)
    
    # 检测是否为本地/LAN请求
    forwarded = ""
    if request and request.headers:
        forwarded = request.headers.get("x-forwarded-for", "")
    is_local = (not forwarded or forwarded.strip() in ("", "127.0.0.1", "::1"))
    if not is_local:
        for prefix in ("192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
                       "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
                       "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31."):
            if forwarded.startswith(prefix):
                is_local = True
                break
    if is_local:
        logger.info(f"本地下载: {local_path}")
        return FileResponse(
            path=str(local_path),
            media_type="application/vnd.android.package-archive",
            filename=local_path.name,
        )
    # 公网请求 → 302重定向到CDN域名nginx静态文件(不走HK SSH隧道)
    logger.info(f"公网下载重定向(CDN): {public_url}")
    return RedirectResponse(url=public_url, status_code=302)
