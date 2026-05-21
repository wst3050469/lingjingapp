import { type HealthCheckResult } from '../observability/health-checker.js';
import type { AgentScheduler } from '../agent/agent-scheduler.js';
export declare class GracefulShutdown {
    private checker;
    private isShuttingDown;
    private cleanupFns;
    private scheduler?;
    constructor();
    registerCleanup(fn: () => Promise<void>): void;
    setScheduler(scheduler: AgentScheduler): void;
    registerHealthCheck(name: string, check: () => Promise<HealthCheckResult>): void;
    shutdown(reason?: string): Promise<void>;
    isShuttingDownState(): boolean;
    private registerSignalHandlers;
}
//# sourceMappingURL=graceful-shutdown.d.ts.map