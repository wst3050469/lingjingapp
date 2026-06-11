"""租户资源配额服务

持久化配额管理：数据库存储 + 用量追踪 + 超限检查。

配额层级:
  free      - 1用户/100MB/1000次API/1并发
  starter   - 5用户/1GB/10000次API/3并发
  pro       - 50用户/10GB/100000次API/20并发
  enterprise - 无限

自定义配置存储在 tenants.config JSONB 中，优先级高于 tier 默认值。
"""

from typing import Optional, Dict
from datetime import date
import db as database

# ── 配额等级定义 ──

DEFAULT_QUOTAS = {
    'free': {'maxUsers': 1, 'maxStorageMB': 100, 'maxApiCallsPerDay': 1000, 'maxConcurrentSessions': 1},
    'starter': {'maxUsers': 5, 'maxStorageMB': 1024, 'maxApiCallsPerDay': 10000, 'maxConcurrentSessions': 3},
    'pro': {'maxUsers': 50, 'maxStorageMB': 10240, 'maxApiCallsPerDay': 100000, 'maxConcurrentSessions': 20},
    'enterprise': {'maxUsers': 999999, 'maxStorageMB': 999999, 'maxApiCallsPerDay': 999999, 'maxConcurrentSessions': 999999},
}


async def get_tenant_plan(tenant_id: str) -> str:
    """获取租户的套餐等级，默认 'free'"""
    async with database.get_conn() as conn:
        row = await conn.fetchrow(
            "SELECT plan, config FROM tenants WHERE tenant_id=$1", tenant_id)
        if not row:
            return 'free'
        return row['plan'] or 'free'


async def get_tenant_config(tenant_id: str) -> Dict:
    """获取租户的 config JSONB"""
    async with database.get_conn() as conn:
        row = await conn.fetchrow(
            "SELECT config FROM tenants WHERE tenant_id=$1", tenant_id)
        if not row:
            return {}
        return row['config'] or {}


async def get_tenant_quota(tenant_id: str) -> Dict:
    """获取租户的完整配额（tier默认 + 自定义覆盖）"""
    plan = await get_tenant_plan(tenant_id)
    config = await get_tenant_config(tenant_id)
    base = DEFAULT_QUOTAS.get(plan, DEFAULT_QUOTAS['free']).copy()
    # config.quotaOverrides 可以覆盖部分字段
    overrides = config.get('quotaOverrides', {})
    base.update(overrides)
    base['plan'] = plan
    return base


async def set_tenant_plan(tenant_id: str, plan: str) -> bool:
    """设置租户套餐等级"""
    if plan not in DEFAULT_QUOTAS:
        raise ValueError(f"无效的套餐等级: {plan}")
    async with database.get_conn() as conn:
        result = await conn.execute(
            "UPDATE tenants SET plan=$1, updated_at=NOW() WHERE tenant_id=$2",
            plan, tenant_id)
        return 'UPDATE 1' in result


async def set_quota_overrides(tenant_id: str, overrides: Dict) -> bool:
    """设置租户配额自定义覆盖（写入 config.quotaOverrides）"""
    valid_keys = {'maxUsers', 'maxStorageMB', 'maxApiCallsPerDay', 'maxConcurrentSessions'}
    filtered = {k: v for k, v in overrides.items() if k in valid_keys and isinstance(v, (int, float))}
    async with database.get_conn() as conn:
        row = await conn.fetchrow("SELECT config FROM tenants WHERE tenant_id=$1", tenant_id)
        if not row:
            return False
        config = row['config'] or {}
        config['quotaOverrides'] = filtered
        await conn.execute(
            "UPDATE tenants SET config=$1, updated_at=NOW() WHERE tenant_id=$2",
            config, tenant_id)
        return True


async def report_usage(tenant_id: str, resource: str, amount: int = 1) -> None:
    """记录资源用量（API调用次数等）"""
    today = date.today()
    async with database.get_conn() as conn:
        await conn.execute(
            """INSERT INTO tenant_usage (tenant_id, resource, used_count, reset_date)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (tenant_id, resource, reset_date)
               DO UPDATE SET used_count = tenant_usage.used_count + $3,
                             updated_at = NOW()""",
            tenant_id, resource, amount, today)


async def get_current_usage(tenant_id: str, resource: str) -> int:
    """获取今日用量"""
    today = date.today()
    async with database.get_conn() as conn:
        row = await conn.fetchrow(
            "SELECT used_count FROM tenant_usage WHERE tenant_id=$1 AND resource=$2 AND reset_date=$3",
            tenant_id, resource, today)
        return row['used_count'] if row else 0


async def check_quota(tenant_id: str, resource: str) -> Dict:
    """
    检查配额是否超限。
    返回: {"allowed": bool, "limit": int, "used": int, "remaining": int}
    """
    quota = await get_tenant_quota(tenant_id)
    limit = quota.get(resource, 0)
    used = await get_current_usage(tenant_id, resource)

    # enterprise 无限
    if limit >= 999998:
        return {"allowed": True, "limit": limit, "used": used, "remaining": 999999}

    remaining = max(0, limit - used)
    return {"allowed": used < limit, "limit": limit, "used": used, "remaining": remaining}


async def get_all_usage(tenant_id: str) -> Dict[str, int]:
    """获取租户所有资源的今日用量"""
    today = date.today()
    async with database.get_conn() as conn:
        rows = await conn.fetch(
            "SELECT resource, used_count FROM tenant_usage WHERE tenant_id=$1 AND reset_date=$2",
            tenant_id, today)
    return {row['resource']: row['used_count'] for row in rows}
