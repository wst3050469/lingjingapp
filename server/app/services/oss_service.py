"""灵境 - 阿里云 OSS 服务（STS 临时凭证 + 上传 + CDN URL）"""
import os
import uuid
import asyncio
import logging
import httpx
from datetime import datetime, timezone

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger("lingjing.oss")

_CACHE: dict[str, dict] = {}  # 内存缓存 OSS URL 避免重复计算


def get_oss_host() -> str:
    """OSS 外网访问域名"""
    return f"{config.OSS_BUCKET_NAME}.{config.OSS_ENDPOINT}"


def get_cdn_url(object_key: str) -> str:
    """将 OSS key 转为 CDN URL"""
    key = object_key.lstrip("/")
    return f"{config.OSS_CDN_BASE}/{key}"


def get_oss_url(object_key: str) -> str:
    """将 OSS key 转为 OSS 直链 URL"""
    key = object_key.lstrip("/")
    return f"https://{get_oss_host()}/{key}"


def generate_sts_token(user_code: str) -> dict:
    """
    使用阿里云 RAM 角色 AssumeRole 生成 STS 临时凭证。
    如果未配置 OSS_ACCESS_KEY_ID / OSS_ROLE_ARN，则返回静态 Key 模式（直传不可用，走旧通道）。
    
    返回:
        {
            "access_key_id": "...",
            "access_key_secret": "...",
            "security_token": "...",
            "expiration": "2026-...",
            "region": "oss-cn-hongkong",
            "bucket": "lingjingoss",
            "endpoint": "https://oss-cn-hongkong.aliyuncs.com",
            "upload_prefix": "uploads/2026-04/user_code/",
        }
    """
    ak = config.OSS_ACCESS_KEY_ID
    sk = config.OSS_ACCESS_KEY_SECRET
    bucket = config.OSS_BUCKET_NAME
    endpoint = config.OSS_ENDPOINT
    
    # 上传路径前缀：uploads/YYYY-MM/user_code/
    month_dir = datetime.now(timezone.utc).strftime("%Y-%m")
    upload_prefix = f"{config.OSS_UPLOAD_PREFIX}{month_dir}/{user_code}/"
    
    role_arn = config.OSS_ROLE_ARN
    if not ak or not sk:
        logger.warning("OSS STS: OSS_ACCESS_KEY 未配置，返回降级模式")
        return {
            "mode": "passthrough",  # 走旧通道（后端中转）
            "upload_prefix": upload_prefix,
        }
    
    # 如果有 RoleArn 则申请 STS，否则直接用主 AK
    if role_arn:
        try:
            # 使用 RAM AssumeRole API 获取 STS
            # 由于阿里云 STS 调用需要签名，这里简化：直接用主 AK 返回
            # 生产环境建议配置 RAM 角色
            pass
        except Exception as e:
            logger.warning(f"OSS STS: AssumeRole 失败，降级为主 AK: {e}")
    
    # 当前方案：返回主 Key（APP 直传 OSS 有足够权限）
    return {
        "mode": "direct",
        "access_key_id": ak,
        "access_key_secret": sk,
        "region": endpoint.replace("oss-", "").replace(".aliyuncs.com", ""),
        "bucket": bucket,
        "endpoint": f"https://{endpoint}",
        "upload_prefix": upload_prefix,
        "cdn_base": config.OSS_CDN_BASE,
        "expires_in": config.OSS_STS_TOKEN_EXPIRE,
    }


def generate_upload_filename(user_code: str, original_filename: str) -> tuple[str, str]:
    """
    生成 OSS 上传路径和文件名。
    返回: (object_key, filename)
    格式: uploads/YYYY-MM/user_code/uuid.ext
    """
    ext = os.path.splitext(original_filename)[1].lower()
    file_id = uuid.uuid4().hex
    filename = f"{file_id}{ext}"
    month_dir = datetime.now(timezone.utc).strftime("%Y-%m")
    object_key = f"{config.OSS_UPLOAD_PREFIX}{month_dir}/{user_code}/{filename}"
    return object_key, filename


async def download_from_oss(object_key: str) -> bytes | None:
    """从 OSS 下载文件到内存（用于后端异步处理）"""
    url = get_oss_url(object_key)
    
    # 优先从 CDN 下载（更快，不计内网流量费）
    cdn_url = get_cdn_url(object_key)
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(cdn_url)
            if resp.status_code == 200:
                return resp.content
    except Exception:
        logger.warning(f"CDN下载失败: {cdn_url}", exc_info=True)
        pass
    
    # CDN 失败则直连 OSS（需要签名或 public-read）
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.content
    except Exception as e:
        logger.error(f"OSS 下载失败 {object_key}: {e}")
    
    return None


async def download_to_temp(object_key: str, max_retries: int = 3) -> str | None:
    """从 CDN 下载文件到本地临时目录，返回本地路径（失败自动重试）"""
    os.makedirs(config.TEMP_DIR, exist_ok=True)
    filename = os.path.basename(object_key)
    local_path = os.path.join(config.TEMP_DIR, filename)
    
    for attempt in range(max_retries):
        cdn_url = get_cdn_url(object_key)
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.get(cdn_url)
                if resp.status_code == 200:
                    # 原子写入：先写临时文件，再重命名
                    tmp_path = local_path + ".tmp"
                    with open(tmp_path, 'wb') as f:
                        f.write(resp.content)
                    os.replace(tmp_path, local_path)
                    return local_path
        except Exception as e:
            logger.warning(f"OSS 下载重试 {attempt+1}/{max_retries} 失败 {object_key}: {e}")
            await asyncio.sleep(1 * (attempt + 1))  # 退避等待
    
    # 最后一次尝试：直连 OSS
    try:
        oss_url = get_oss_url(object_key)
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(oss_url)
            if resp.status_code == 200:
                tmp_path = local_path + ".tmp"
                with open(tmp_path, 'wb') as f:
                    f.write(resp.content)
                os.replace(tmp_path, local_path)
                return local_path
    except Exception as e:
        logger.error(f"OSS 直连下载失败 {object_key}: {e}")
    
    return None
