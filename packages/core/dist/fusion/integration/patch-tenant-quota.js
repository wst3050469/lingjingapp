/**
 * Tenant Resource Quota — Batch D (P1)
 *
 * Per-tenant resource limits for cloud-server multi-tenant scenarios.
 */
export const DEFAULT_QUOTAS = {
    free: {
        tier: 'free',
        maxUsers: 1,
        maxStorageMB: 100,
        maxApiCallsPerDay: 1000,
        maxConcurrentSessions: 1,
    },
    starter: {
        tier: 'starter',
        maxUsers: 5,
        maxStorageMB: 1024,
        maxApiCallsPerDay: 10000,
        maxConcurrentSessions: 3,
    },
    pro: {
        tier: 'pro',
        maxUsers: 50,
        maxStorageMB: 10240,
        maxApiCallsPerDay: 100000,
        maxConcurrentSessions: 20,
    },
    enterprise: {
        tier: 'enterprise',
        maxUsers: Infinity,
        maxStorageMB: Infinity,
        maxApiCallsPerDay: Infinity,
        maxConcurrentSessions: Infinity,
    },
};
const tenantQuotaStore = new Map();
const tenantUsageStore = new Map();
export function setTenantQuota(quota) {
    tenantQuotaStore.set(quota.tenantId, quota);
    if (!tenantUsageStore.has(quota.tenantId)) {
        tenantUsageStore.set(quota.tenantId, {
            maxUsers: 0,
            maxStorageMB: 0,
            maxApiCallsPerDay: 0,
            maxConcurrentSessions: 0,
        });
    }
}
export function getTenantQuota(tenantId) {
    return tenantQuotaStore.get(tenantId);
}
export function reportUsage(tenantId, resource, amount) {
    const usage = tenantUsageStore.get(tenantId);
    if (usage) {
        usage[resource] += amount;
    }
}
export function getCurrentUsage(tenantId, resource) {
    return tenantUsageStore.get(tenantId)?.[resource] ?? 0;
}
export function checkQuota(tenantId, resource) {
    const quota = tenantQuotaStore.get(tenantId);
    if (!quota)
        return false;
    const limit = quota[resource];
    const usage = getCurrentUsage(tenantId, resource);
    return usage < limit;
}
export function resetAllQuotas() {
    tenantQuotaStore.clear();
    tenantUsageStore.clear();
}
//# sourceMappingURL=patch-tenant-quota.js.map