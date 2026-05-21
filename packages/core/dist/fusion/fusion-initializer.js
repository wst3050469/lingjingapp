import { logger } from '../utils/logger.js';
const INIT_ORDER = [
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
export class FusionInitializer {
    moduleStates = new Map();
    eventBus = null;
    hookRegistry = null;
    vectorMemory = null;
    reviewEngine = null;
    securityScanner = null;
    traceHarvester = null;
    dagOrchestrator = null;
    multiAgent = null;
    modelRouter = null;
    nlCron = null;
    userModeler = null;
    setEventBus(eventBus) { this.eventBus = eventBus; }
    setHookRegistry(registry) { this.hookRegistry = registry; }
    setVectorMemory(store) { this.vectorMemory = store; }
    setReviewEngine(engine) { this.reviewEngine = engine; }
    setSecurityScanner(scanner) { this.securityScanner = scanner; }
    setTraceHarvester(harvester) { this.traceHarvester = harvester; }
    setDAGOrchestrator(orchestrator) { this.dagOrchestrator = orchestrator; }
    setMultiAgent(executor) { this.multiAgent = executor; }
    setModelRouter(router) { this.modelRouter = router; }
    setNLCron(scheduler) { this.nlCron = scheduler; }
    setUserModeler(modeler) { this.userModeler = modeler; }
    initialize(config) {
        const initialized = [];
        const failed = [];
        const degraded = [];
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
            }
            catch (err) {
                const errorMsg = err.message;
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
    toggleModule(moduleName, enabled) {
        const state = this.moduleStates.get(moduleName);
        if (state) {
            state.enabled = enabled;
            this.moduleStates.set(moduleName, state);
        }
    }
    healthCheck() {
        const result = new Map();
        for (const [name, state] of this.moduleStates) {
            result.set(name, { healthy: state.healthy, enabled: state.enabled });
        }
        return result;
    }
    initModule(moduleName) {
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
    mapToConfigName(moduleName) {
        const map = {
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
//# sourceMappingURL=fusion-initializer.js.map