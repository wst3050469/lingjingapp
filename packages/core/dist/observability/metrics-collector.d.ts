export type MetricType = 'counter' | 'histogram' | 'gauge';
export declare const METRICS: {
    readonly AGENT_EXECUTIONS_TOTAL: "agent_executions_total";
    readonly AGENT_EXECUTION_DURATION_MS: "agent_execution_duration_ms";
    readonly TOOL_CALLS_TOTAL: "tool_calls_total";
    readonly TOOL_CALL_DURATION_MS: "tool_call_duration_ms";
    readonly TOOL_CALL_ERRORS_TOTAL: "tool_call_errors_total";
    readonly LLM_REQUESTS_TOTAL: "llm_requests_total";
    readonly LLM_TOKENS_INPUT: "llm_tokens_input";
    readonly LLM_TOKENS_OUTPUT: "llm_tokens_output";
    readonly LLM_REQUEST_DURATION_MS: "llm_request_duration_ms";
    readonly CONTEXT_COMPACTIONS_TOTAL: "context_compactions_total";
    readonly CONTEXT_TOKENS_USED: "context_tokens_used";
    readonly CIRCUIT_BREAKER_STATE: "circuit_breaker_state";
};
export declare class MetricsCollector {
    private metrics;
    incrementCounter(name: string, value?: number, labels?: Record<string, string>): void;
    recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
    setGauge(name: string, value: number, labels?: Record<string, string>): void;
    snapshot(): Record<string, unknown>;
    reset(): void;
}
//# sourceMappingURL=metrics-collector.d.ts.map