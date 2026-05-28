"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FUSION_CONFIG = exports.FUSION_MODULES = void 0;
exports.FUSION_MODULES = [
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
exports.DEFAULT_FUSION_CONFIG = {
    enabled: false,
    modules: exports.FUSION_MODULES.map((name) => ({ name, enabled: false, config: {} })),
    globalTimeout: 100,
    retryAttempts: 3,
    retryDelayMs: 1000,
};
//# sourceMappingURL=types.js.map