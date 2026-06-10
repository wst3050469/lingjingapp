/**
 * Fusion Module Health Check — Batch D (P1)
 *
 * Validates all 16 fusion modules and produces FusionHealthReport.
 */
import type { FusionConfig } from '../types.js';
import type { IEventBus } from '../event-bus/types.js';
import type { IHookRegistry } from '../hook-registry/types.js';
import type { IVectorMemoryStore } from '../vector-memory/types.js';
import type { INudgeReviewEngine } from '../review-engine/types.js';
import type { SecurityScanner } from '../skill-security/security-scanner.js';
import type { ExecutionTraceHarvester } from '../trace-harvester/execution-trace-harvester.js';
import type { IDAGOrchestrator } from '../dag-orchestrator/types.js';
import type { IMultiAgentExecutor } from '../multi-agent/types.js';
import type { IDynamicModelRouter } from '../model-router/types.js';
import type { INLCronScheduler } from '../nl-cron/types.js';
import type { IHonchoUserModeler } from '../user-modeler/types.js';
import type { IConnectorHubAdapter } from '../connectors/types.js';
import type { IMessageGateway } from '../gateway/types.js';
export interface FusionHealthModule {
    name: string;
    healthy: boolean;
    details: string;
    enabled: boolean;
}
export interface FusionHealthReport {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    modules: FusionHealthModule[];
    timestamp: number;
}
interface HealthCheckDeps {
    config: FusionConfig;
    eventBus?: IEventBus;
    hookRegistry?: IHookRegistry;
    vectorMemory?: IVectorMemoryStore;
    reviewEngine?: INudgeReviewEngine;
    securityScanner?: SecurityScanner;
    traceHarvester?: ExecutionTraceHarvester;
    dagOrchestrator?: IDAGOrchestrator;
    multiAgent?: IMultiAgentExecutor;
    modelRouter?: IDynamicModelRouter;
    nlCron?: INLCronScheduler;
    userModeler?: IHonchoUserModeler;
    connectorHub?: IConnectorHubAdapter;
    messageGateway?: IMessageGateway;
    openSpaceProcessAlive?: boolean;
    openSpaceWsConnected?: boolean;
}
export declare function runFusionHealthCheck(deps: HealthCheckDeps): FusionHealthReport;
export {};
//# sourceMappingURL=health-check.d.ts.map