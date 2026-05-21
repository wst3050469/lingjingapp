export const FUSION_MODULES = [
    'event_bus',
    'hook_registry',
    'vector_memory',
    'execution_traces',
    'skill_security',
    'dag_engine',
    'model_routing',
    'cron_scheduler',
    'user_profiler',
    'review_gate',
    'parallel_executor',
    'circuit_breaker',
];
export const DEFAULT_FUSION_CONFIG = {
    enabled: false,
    modules: FUSION_MODULES.map((name) => ({ name, enabled: false, config: {} })),
    globalTimeout: 100,
    retryAttempts: 3,
    retryDelayMs: 1000,
};
//# sourceMappingURL=types.js.map