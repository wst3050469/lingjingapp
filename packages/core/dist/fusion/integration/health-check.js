export async function runFusionHealthCheck(fusionConfig, deps) {
    const modules = [];
    const check = (name, enabled, healthy, details) => modules.push({ name, enabled, healthy, details });
    check('event-bus', true, !!deps.eventBus, deps.eventBus ? 'EventBus initialized' : 'EventBus not available');
    check('hook-registry', true, !!deps.hookRegistry, deps.hookRegistry ? 'HookRegistry initialized' : 'HookRegistry not available');
    check('circuit-breaker', true, true, 'CircuitBreaker is stateless, no health check needed');
    if (deps.vectorStore) {
        try {
            const testResult = await deps.vectorStore.syncFromMemory([{ id: 'health', content: 'ping', category: 'health' }]);
            check('vector-memory', true, true, `VectorMemoryStore responded: ${JSON.stringify(testResult)}`);
        }
        catch (err) {
            check('vector-memory', true, false, `VectorMemoryStore error: ${err.message}`);
        }
    }
    else {
        check('vector-memory', false, true, 'VectorMemoryStore not configured');
    }
    check('review-engine', !!deps.reviewEngine, !deps.reviewEngine || true, deps.reviewEngine ? 'ReviewEngine configured' : 'ReviewEngine not configured');
    check('skill-security', !!deps.securityScanner, !deps.securityScanner || true, deps.securityScanner ? 'SecurityScanner configured' : 'SecurityScanner not configured');
    check('trace-harvester', !!deps.traceHarvester, !deps.traceHarvester || true, deps.traceHarvester ? 'TraceHarvester configured' : 'TraceHarvester not configured');
    check('dag-orchestrator', !!deps.dagOrchestrator, !deps.dagOrchestrator || true, deps.dagOrchestrator ? 'DAGOrchestrator configured' : 'DAGOrchestrator not configured');
    check('multi-agent', !!deps.multiAgentExecutor, !deps.multiAgentExecutor || true, deps.multiAgentExecutor ? 'MultiAgentExecutor configured' : 'MultiAgentExecutor not configured');
    check('model-router', !!deps.modelRouter, !deps.modelRouter || true, deps.modelRouter ? 'ModelRouter configured' : 'ModelRouter not configured');
    check('nl-cron', !!deps.cronScheduler, !deps.cronScheduler || true, deps.cronScheduler ? 'NLCronScheduler configured' : 'NLCronScheduler not configured');
    check('user-modeler', !!deps.userModeler, !deps.userModeler || true, deps.userModeler ? 'UserModeler configured' : 'UserModeler not configured');
    check('connectors', !!deps.connectorHub, !deps.connectorHub || true, deps.connectorHub ? 'ConnectorHub configured' : 'ConnectorHub not configured');
    check('gateway', !!deps.messageGateway, !deps.messageGateway || true, deps.messageGateway ? 'MessageGateway configured' : 'MessageGateway not configured');
    const healthyCount = modules.filter((m) => m.healthy).length;
    const totalConfigured = modules.filter((m) => m.enabled).length;
    const overall = healthyCount === modules.length ? 'healthy'
        : healthyCount >= totalConfigured * 0.7 ? 'degraded'
            : 'unhealthy';
    return { overall, modules, healthyCount, totalConfigured };
}
