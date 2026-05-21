import type { FusionConfig } from './types.js';
import type { IEventBus } from './event-bus/types.js';
import type { IHookRegistry } from './hook-registry/types.js';
import type { IVectorMemoryStore } from './vector-memory/types.js';
import type { INudgeReviewEngine } from './review-engine/types.js';
import type { SecurityScanner } from './skill-security/security-scanner.js';
import type { ExecutionTraceHarvester } from './trace-harvester/execution-trace-harvester.js';
import type { IDAGOrchestrator } from './dag-orchestrator/types.js';
import type { IMultiAgentExecutor } from './multi-agent/types.js';
import type { IDynamicModelRouter } from './model-router/types.js';
import type { INLCronScheduler } from './nl-cron/types.js';
import type { IHonchoUserModeler } from './user-modeler/types.js';
type ModuleName = 'eventBus' | 'hookRegistry' | 'slidingWindow' | 'vectorMemory' | 'reviewEngine' | 'traceHarvester' | 'skillSecurity' | 'dagOrchestrator' | 'multiAgent' | 'modelRouter' | 'nlCron' | 'userModeler';
export interface FusionInitResult {
    success: boolean;
    initialized: ModuleName[];
    failed: Array<{
        module: ModuleName;
        error: string;
    }>;
    degraded: ModuleName[];
}
export declare class FusionInitializer {
    private moduleStates;
    private eventBus;
    private hookRegistry;
    private vectorMemory;
    private reviewEngine;
    private securityScanner;
    private traceHarvester;
    private dagOrchestrator;
    private multiAgent;
    private modelRouter;
    private nlCron;
    private userModeler;
    setEventBus(eventBus: IEventBus): void;
    setHookRegistry(registry: IHookRegistry): void;
    setVectorMemory(store: IVectorMemoryStore): void;
    setReviewEngine(engine: INudgeReviewEngine): void;
    setSecurityScanner(scanner: SecurityScanner): void;
    setTraceHarvester(harvester: ExecutionTraceHarvester): void;
    setDAGOrchestrator(orchestrator: IDAGOrchestrator): void;
    setMultiAgent(executor: IMultiAgentExecutor): void;
    setModelRouter(router: IDynamicModelRouter): void;
    setNLCron(scheduler: INLCronScheduler): void;
    setUserModeler(modeler: IHonchoUserModeler): void;
    initialize(config: FusionConfig): FusionInitResult;
    toggleModule(moduleName: ModuleName, enabled: boolean): void;
    healthCheck(): Map<ModuleName, {
        healthy: boolean;
        enabled: boolean;
    }>;
    private initModule;
    private mapToConfigName;
}
export {};
//# sourceMappingURL=fusion-initializer.d.ts.map