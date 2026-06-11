"""租户配额拦截依赖

在 API 端点注入 QuotaCheck，自动检查 + 计数。

使用示例:
    from dependencies.quota import require_quota

    @router.post("/chat")
    async def chat(quota=Depends(require_quota("maxApiCallsPerDay"))):
        ...
"""

from fastapi import HTTPException, Request, Depends
from services.quota_service import check_quota, report_usage


class QuotaExceeded(HTTPException):
    """配额超限异常"""
    def __init__(self, resource: str, limit: int, used: int):
        super().__init__(
            status_code=429,
            detail={
                "error": "quota_exceeded",
                "resource": resource,
                "limit": limit,
                "used": used,
                "message": f"资源配额已用尽: {resource} ({used}/{limit})",
            }
        )


def require_quota(resource: str):
    """
    返回一个 FastAPI 依赖，检查指定资源的配额。

    Usage:
        @router.post("/ai/chat")
        async def chat(quota=Depends(require_quota("maxApiCallsPerDay"))):
            ...
    """
    async def _check(request: Request):
        tenant_id = _extract_tenant_id(request)
        if not tenant_id:
            return True  # 无租户上下文时跳过配额检查

        result = await check_quota(tenant_id, resource)
        if not result['allowed']:
            raise QuotaExceeded(resource, result['limit'], result['used'])

        await report_usage(tenant_id, resource, 1)
        return True

    return _check


def _extract_tenant_id(request: Request) -> str:
    """从请求中提取 tenant_id"""
    # 优先从认证用户中获取
    if hasattr(request.state, 'user'):
        user = request.state.user
        if isinstance(user, dict):
            return user.get('tenant_id', '')

    # 尝试从 header 获取
    return request.headers.get('x-tenant-id', '')
