const tenantQuotas = new Map();
export const DEFAULT_QUOTAS = {
    free: { tier: 'free', maxUsers: 5, maxStorageMB: 100, maxApiCallsPerDay: 1000, maxConcurrentSessions: 2 },
    starter: { tier: 'starter', maxUsers: 20, maxStorageMB: 1024, maxApiCallsPerDay: 10000, maxConcurrentSessions: 10 },
    pro: { tier: 'pro', maxUsers: 100, maxStorageMB: 10240, maxApiCallsPerDay: 100000, maxConcurrentSessions: 50 },
    enterprise: { tier: 'enterprise', maxUsers: 9999, maxStorageMB: 102400, maxApiCallsPerDay: 999999999, maxConcurrentSessions: 9999 },
};
const usageStore = new Map();
export function setTenantQuota(tenantId, quota) {
    const full = { tenantId, ...quota };
    tenantQuotas.set(tenantId, full);
    return full;
}
export function getTenantQuota(tenantId) {
    return tenantQuotas.get(tenantId) ?? null;
}
export function reportUsage(tenantId, resource, amount = 1) {
    const key = `${tenantId}:${resource}`;
    const now = Date.now();
    const existing = usageStore.get(key);
    if (existing && now - existing.timestamp < 86400000) {
        existing.usage += amount;
        existing.timestamp = now;
    }
    else {
        usageStore.set(key, { usage: amount, timestamp: now });
    }
}
export function getCurrentUsage(tenantId, resource) {
    const key = `${tenantId}:${resource}`;
    const entry = usageStore.get(key);
    if (!entry)
        return 0;
    if (Date.now() - entry.timestamp > 86400000) {
        usageStore.delete(key);
        return 0;
    }
    return entry.usage;
}
export function checkQuota(tenantId, resource) {
    const quota = tenantQuotas.get(tenantId);
    if (!quota)
        return { allowed: false, reason: 'no_quota' };
    const usage = getCurrentUsage(tenantId, resource);
    const limits = {
        max_users: quota.maxUsers,
        max_storage_mb: quota.maxStorageMB,
        max_api_calls_per_day: quota.maxApiCallsPerDay,
        max_concurrent_sessions: quota.maxConcurrentSessions,
    };
    const limit = limits[resource];
    if (limit == null)
        return { allowed: true };
    if (usage >= limit)
        return { allowed: false, reason: 'quota_exceeded', usage, limit };
    return { allowed: true, usage, limit };
}
export function resetAllQuotas() {
    tenantQuotas.clear();
    usageStore.clear();
}
