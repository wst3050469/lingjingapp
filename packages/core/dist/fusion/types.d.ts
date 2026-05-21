export interface FusionConfig {
    enabled: boolean;
    modules: FusionModuleConfig[];
    globalTimeout: number;
    retryAttempts: number;
    retryDelayMs: number;
}
export interface FusionModuleConfig {
    name: string;
    enabled: boolean;
    config: Record<string, unknown>;
}
export interface FusionHealthReport {
    healthy: boolean;
    modules: Array<{
        name: string;
        healthy: boolean;
        details: Record<string, unknown>;
    }>;
    timestamp: number;
}
export type FusionModule = 'event_bus' | 'hook_registry' | 'vector_memory' | 'execution_traces' | 'skill_security' | 'dag_engine' | 'model_routing' | 'cron_scheduler' | 'user_profiler' | 'review_gate' | 'parallel_executor' | 'circuit_breaker';
export declare const FUSION_MODULES: FusionModule[];
export declare const DEFAULT_FUSION_CONFIG: FusionConfig;
//# sourceMappingURL=types.d.ts.map