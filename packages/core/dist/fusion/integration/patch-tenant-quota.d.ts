export declare type TenantTier = 'free' | 'starter' | 'pro' | 'enterprise';
export interface TenantQuota {
    tenantId: string;
    tier: TenantTier;
    maxUsers: number;
    maxStorageMB: number;
    maxApiCallsPerDay: number;
    maxConcurrentSessions: number;
}
export declare type QuotaResource = 'max_users' | 'max_storage_mb' | 'max_api_calls_per_day' | 'max_concurrent_sessions';
export declare const DEFAULT_QUOTAS: Record<TenantTier, Omit<TenantQuota, 'tenantId'>>;
export declare function setTenantQuota(tenantId: string, quota: Omit<TenantQuota, 'tenantId'>): TenantQuota;
export declare function getTenantQuota(tenantId: string): TenantQuota | null;
export declare function reportUsage(tenantId: string, resource: QuotaResource, amount?: number): void;
export declare function getCurrentUsage(tenantId: string, resource: QuotaResource): number;
export declare function checkQuota(tenantId: string, resource: QuotaResource): {
    allowed: boolean;
    reason?: string;
    usage?: number;
    limit?: number;
};
export declare function resetAllQuotas(): void;
