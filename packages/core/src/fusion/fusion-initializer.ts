import type { FusionConfig, FusionModuleConfig } from './types.js';
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
import { logger } from '../utils/logger.js';

type ModuleName =
  | 'eventBus'
  | 'hookRegistry'
  | 'slidingWindow'
  | 'vectorMemory'
  | 'reviewEngine'
  | 'traceHarvester'
  | 'skillSecurity'
  | 'dagOrchestrator'
  | 'multiAgent'
  | 'modelRouter'
  | 'nlCron'
  | 'userModeler';

const INIT_ORDER: ModuleName[] = [
  'eventBus',
  'hookRegistry',
  'slidingWindow',
  'vectorMemory',
  'reviewEngine',
  'traceHarvester',
  'skillSecurity',
  'dagOrchestrator',
  'multiAgent',
  'modelRouter',
  'nlCron',
  'userModeler',
];

interface ModuleState {
  enabled: boolean;
  healthy: boolean;
  initialized: boolean;
  error?: string;
}

export interface FusionInitResult {
  success: boolean;
  initialized: ModuleName[];
  failed: Array<{ module: ModuleName; error: string }>;
  degraded: ModuleName[];
}

export class FusionInitializer {
  private moduleStates = new Map<ModuleName, ModuleState>();
  private eventBus: IEventBus | null = null;
  private hookRegistry: IHookRegistry | null = null;
  private vectorMemory: IVectorMemoryStore | null = null;
  private reviewEngine: INudgeReviewEngine | null = null;
  private securityScanner: SecurityScanner | null = null;
  private traceHarvester: ExecutionTraceHarvester | null = null;
  private dagOrchestrator: IDAGOrchestrator | null = null;
  private multiAgent: IMultiAgentExecutor | null = null;
  private modelRouter: IDynamicModelRouter | null = null;
  private nlCron: INLCronScheduler | null = null;
  private userModeler: IHonchoUserModeler | null = null;

  setEventBus(eventBus: IEventBus): void { this.eventBus = eventBus; }
  setHookRegistry(registry: IHookRegistry): void { this.hookRegistry = registry; }
  setVectorMemory(store: IVectorMemoryStore): void { this.vectorMemory = store; }
  setReviewEngine(engine: INudgeReviewEngine): void { this.reviewEngine = engine; }
  setSecurityScanner(scanner: SecurityScanner): void { this.securityScanner = scanner; }
  setTraceHarvester(harvester: ExecutionTraceHarvester): void { this.traceHarvester = harvester; }
  setDAGOrchestrator(orchestrator: IDAGOrchestrator): void { this.dagOrchestrator = orchestrator; }
  setMultiAgent(executor: IMultiAgentExecutor): void { this.multiAgent = executor; }
  setModelRouter(router: IDynamicModelRouter): void { this.modelRouter = router; }
  setNLCron(scheduler: INLCronScheduler): void { this.nlCron = scheduler; }
  setUserModeler(modeler: IHonchoUserModeler): void { this.userModeler = modeler; }

  initialize(config: FusionConfig): FusionInitResult {
    const initialized: ModuleName[] = [];
    const failed: Array<{ module: ModuleName; error: string }> = [];
    const degraded: ModuleName[] = [];

    for (const moduleName of INIT_ORDER) {
      const moduleConfig = config.modules.find((m) => this.mapToConfigName(moduleName) === m.name);
      if (!moduleConfig || !moduleConfig.enabled) {
        this.moduleStates.set(moduleName, { enabled: false, healthy: false, initialized: false });
        continue;
      }

      try {
        const healthy = this.initModule(moduleName);
        this.moduleStates.set(moduleName, { enabled: true, healthy, initialized: true });
        initialized.push(moduleName);
      } catch (err) {
        const errorMsg = (err as Error).message;
        logger.warn(`[FusionInitializer] module "${moduleName}" init failed: ${errorMsg}`);
        this.moduleStates.set(moduleName, { enabled: true, healthy: false, initialized: false, error: errorMsg });
        failed.push({ module: moduleName, error: errorMsg });
        degraded.push(moduleName);
      }
    }

    return {
      success: failed.length === 0,
      initialized,
      failed,
      degraded,
    };
  }

  toggleModule(moduleName: ModuleName, enabled: boolean): void {
    const state = this.moduleStates.get(moduleName);
    if (state) {
      state.enabled = enabled;
      this.moduleStates.set(moduleName, state);
    }
  }

  healthCheck(): Map<ModuleName, { healthy: boolean; enabled: boolean }> {
    const result = new Map<ModuleName, { healthy: boolean; enabled: boolean }>();
    for (const [name, state] of this.moduleStates) {
      result.set(name, { healthy: state.healthy, enabled: state.enabled });
    }
    return result;
  }

  private initModule(moduleName: ModuleName): boolean {
    switch (moduleName) {
      case 'eventBus':
        return this.eventBus?.healthCheck().healthy ?? false;
      case 'hookRegistry':
        return this.hookRegistry?.healthCheck().healthy ?? false;
      case 'slidingWindow':
        return true;
      case 'vectorMemory':
        return this.vectorMemory?.healthCheck().healthy ?? false;
      case 'reviewEngine':
        return this.reviewEngine?.healthCheck().healthy ?? false;
      case 'traceHarvester':
        return true;
      case 'skillSecurity':
        return this.securityScanner !== null;
      case 'dagOrchestrator':
        return this.dagOrchestrator?.healthCheck().healthy ?? false;
      case 'multiAgent':
        return this.multiAgent?.healthCheck().healthy ?? false;
      case 'modelRouter':
        return this.modelRouter?.healthCheck().healthy ?? false;
      case 'nlCron':
        return this.nlCron?.healthCheck().healthy ?? false;
      case 'userModeler':
        return this.userModeler?.healthCheck().healthy ?? false;
      default:
        return false;
    }
  }

  private mapToConfigName(moduleName: ModuleName): string {
    const map: Record<ModuleName, string> = {
      eventBus: 'event_bus',
      hookRegistry: 'hook_registry',
      slidingWindow: 'sliding_window',
      vectorMemory: 'vector_memory',
      reviewEngine: 'review_gate',
      traceHarvester: 'execution_traces',
      skillSecurity: 'skill_security',
      dagOrchestrator: 'dag_engine',
      multiAgent: 'parallel_executor',
      modelRouter: 'model_routing',
      nlCron: 'cron_scheduler',
      userModeler: 'user_profiler',
    };
    return map[moduleName];
  }
}
