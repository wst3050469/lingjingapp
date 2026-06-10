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
export declare const DEFAULT_QUOTAS: Record<TenantTier, Omit<TenantQuota, 'tenantId'>>;
export type QuotaResource = 'maxUsers' | 'maxStorageMB' | 'maxApiCallsPerDay' | 'maxConcurrentSessions';
export declare function setTenantQuota(quota: TenantQuota): void;
export declare function getTenantQuota(tenantId: string): TenantQuota | undefined;
export declare function reportUsage(tenantId: string, resource: QuotaResource, amount: number): void;
export declare function getCurrentUsage(tenantId: string, resource: QuotaResource): number;
export declare function checkQuota(tenantId: string, resource: QuotaResource): boolean;
export declare function resetAllQuotas(): void;
//# sourceMappingURL=patch-tenant-quota.d.ts.map