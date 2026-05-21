/**
 * Tenant Resource Quota — Batch D (P1)
 *
 * Per-tenant resource limits for cloud-server multi-tenant scenarios.
 */

export type TenantTier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface TenantQuota {
  tenantId: string;
  tier: TenantTier;
  maxUsers: number;
  maxStorageMB: number;
  maxApiCallsPerDay: number;
  maxConcurrentSessions: number;
}

export const DEFAULT_QUOTAS: Record<TenantTier, Omit<TenantQuota, 'tenantId'>> = {
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

export type QuotaResource = 'maxUsers' | 'maxStorageMB' | 'maxApiCallsPerDay' | 'maxConcurrentSessions';

const tenantQuotaStore = new Map<string, TenantQuota>();
const tenantUsageStore = new Map<string, Record<QuotaResource, number>>();

export function setTenantQuota(quota: TenantQuota): void {
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

export function getTenantQuota(tenantId: string): TenantQuota | undefined {
  return tenantQuotaStore.get(tenantId);
}

export function reportUsage(tenantId: string, resource: QuotaResource, amount: number): void {
  const usage = tenantUsageStore.get(tenantId);
  if (usage) {
    usage[resource] += amount;
  }
}

export function getCurrentUsage(tenantId: string, resource: QuotaResource): number {
  return tenantUsageStore.get(tenantId)?.[resource] ?? 0;
}

export function checkQuota(tenantId: string, resource: QuotaResource): boolean {
  const quota = tenantQuotaStore.get(tenantId);
  if (!quota) return false;
  const limit = quota[resource];
  const usage = getCurrentUsage(tenantId, resource);
  return usage < limit;
}

export function resetAllQuotas(): void {
  tenantQuotaStore.clear();
  tenantUsageStore.clear();
}
