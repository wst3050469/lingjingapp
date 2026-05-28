"use strict";
/**
 * Fusion Module Health Check — Batch D (P1)
 *
 * Validates all 16 fusion modules and produces FusionHealthReport.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFusionHealthCheck = runFusionHealthCheck;
function isModuleEnabled(config, configName) {
    return config.modules.some((m) => m.name === configName && m.enabled);
}
function safeCheck(fn) {
    try {
        const ok = fn();
        return { healthy: ok, details: ok ? 'healthy' : 'health check returned false' };
    }
    catch (err) {
        return { healthy: false, details: err.message };
    }
}
function runFusionHealthCheck(deps) {
    const { config } = deps;
    const modules = [];
    modules.push({
        name: 'EventBus',
        enabled: isModuleEnabled(config, 'event_bus'),
        ...safeCheck(() => { const h = deps.eventBus?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'HookRegistry',
        enabled: isModuleEnabled(config, 'hook_registry'),
        ...safeCheck(() => { const h = deps.hookRegistry?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'SlidingWindowMemoryManager',
        enabled: isModuleEnabled(config, 'sliding_window'),
        healthy: true,
        details: 'stateless — always healthy',
    });
    modules.push({
        name: 'VectorMemoryStore',
        enabled: isModuleEnabled(config, 'vector_memory'),
        ...safeCheck(() => { const h = deps.vectorMemory?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'NudgeReviewEngine',
        enabled: isModuleEnabled(config, 'review_gate'),
        ...safeCheck(() => { const h = deps.reviewEngine?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'SkillSecurityLoader',
        enabled: isModuleEnabled(config, 'skill_security'),
        ...safeCheck(() => deps.securityScanner !== null),
    });
    modules.push({
        name: 'ExecutionTraceHarvester',
        enabled: isModuleEnabled(config, 'execution_traces'),
        healthy: deps.traceHarvester !== undefined,
        details: deps.traceHarvester ? 'configured' : 'not configured',
    });
    modules.push({
        name: 'DAGOrchestrator',
        enabled: isModuleEnabled(config, 'dag_engine'),
        ...safeCheck(() => { const h = deps.dagOrchestrator?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'MultiAgentExecutor',
        enabled: isModuleEnabled(config, 'parallel_executor'),
        ...safeCheck(() => { const h = deps.multiAgent?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'DynamicModelRouter',
        enabled: isModuleEnabled(config, 'model_routing'),
        ...safeCheck(() => { const h = deps.modelRouter?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'HonchoUserModeler',
        enabled: isModuleEnabled(config, 'user_profiler'),
        ...safeCheck(() => { const h = deps.userModeler?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'NLCronScheduler',
        enabled: isModuleEnabled(config, 'cron_scheduler'),
        ...safeCheck(() => { const h = deps.nlCron?.healthCheck(); return h?.healthy ?? false; }),
    });
    modules.push({
        name: 'MessageGateway',
        enabled: true,
        healthy: deps.messageGateway !== undefined,
        details: deps.messageGateway ? 'available' : 'not available',
    });
    modules.push({
        name: 'ConnectorHubAdapter',
        enabled: true,
        healthy: deps.connectorHub !== undefined,
        details: deps.connectorHub ? 'available' : 'not available',
    });
    modules.push({
        name: 'OpenSpaceProcessManager',
        enabled: true,
        healthy: deps.openSpaceProcessAlive ?? false,
        details: deps.openSpaceProcessAlive ? 'process alive' : 'process not running',
    });
    modules.push({
        name: 'OpenSpaceBridge',
        enabled: true,
        healthy: deps.openSpaceWsConnected ?? false,
        details: deps.openSpaceWsConnected ? 'WebSocket connected' : 'WebSocket disconnected',
    });
    const enabledModules = modules.filter((m) => m.enabled);
    const healthyCount = enabledModules.filter((m) => m.healthy).length;
    const enabledCount = enabledModules.length;
    let overall;
    if (enabledCount === 0) {
        overall = 'unhealthy';
    }
    else if (healthyCount === enabledCount) {
        overall = 'healthy';
    }
    else if (healthyCount === 0) {
        overall = 'unhealthy';
    }
    else {
        overall = 'degraded';
    }
    return { overall, modules, timestamp: Date.now() };
}
//# sourceMappingURL=health-check.js.map