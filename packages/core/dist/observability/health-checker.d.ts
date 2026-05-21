export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export interface HealthCheck {
    name: string;
    check: () => Promise<HealthCheckResult>;
}
export interface HealthCheckResult {
    status: HealthStatus;
    message?: string;
    details?: Record<string, unknown>;
}
export interface HealthReport {
    status: HealthStatus;
    checks: Record<string, HealthCheckResult>;
    timestamp: number;
}
export declare class HealthChecker {
    private checks;
    private timeoutMs;
    constructor(timeoutMs?: number);
    register(name: string, check: () => Promise<HealthCheckResult>): void;
    unregister(name: string): void;
    check(): Promise<HealthReport>;
}
//# sourceMappingURL=health-checker.d.ts.map