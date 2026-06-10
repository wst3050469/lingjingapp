export type RetryMode = 'noRetry' | 'exponentialBackoff' | 'fixedInterval';
export interface RetryPolicyConfig {
    mode: RetryMode;
    maxRetries: number;
    maxTotalTimeMs: number;
    initialDelayMs: number;
    maxDelayMs: number;
    shouldRetry?: (error: unknown) => boolean;
}
export declare function withRetry<T>(fn: () => Promise<T>, policy?: Partial<RetryPolicyConfig>): Promise<T>;
//# sourceMappingURL=retry.d.ts.map