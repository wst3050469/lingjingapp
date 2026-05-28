"use strict";
/**
 * Tenant Resource Quota — Batch D (P1)
 *
 * Per-tenant resource limits for cloud-server multi-tenant scenarios.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_QUOTAS = void 0;
exports.setTenantQuota = setTenantQuota;
exports.getTenantQuota = getTenantQuota;
exports.reportUsage = reportUsage;
exports.getCurrentUsage = getCurrentUsage;
exports.checkQuota = checkQuota;
exports.resetAllQuotas = resetAllQuotas;
exports.DEFAULT_QUOTAS = {
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
function setTenantQuota(quota) {
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
function getTenantQuota(tenantId) {
    return tenantQuotaStore.get(tenantId);
}
function reportUsage(tenantId, resource, amount) {
    const usage = tenantUsageStore.get(tenantId);
    if (usage) {
        usage[resource] += amount;
    }
}
function getCurrentUsage(tenantId, resource) {
    return tenantUsageStore.get(tenantId)?.[resource] ?? 0;
}
function checkQuota(tenantId, resource) {
    const quota = tenantQuotaStore.get(tenantId);
    if (!quota)
        return false;
    const limit = quota[resource];
    const usage = getCurrentUsage(tenantId, resource);
    return usage < limit;
}
function resetAllQuotas() {
    tenantQuotaStore.clear();
    tenantUsageStore.clear();
}
//# sourceMappingURL=patch-tenant-quota.js.map