export const METRICS = {
    AGENT_EXECUTIONS_TOTAL: 'agent_executions_total',
    AGENT_EXECUTION_DURATION_MS: 'agent_execution_duration_ms',
    TOOL_CALLS_TOTAL: 'tool_calls_total',
    TOOL_CALL_DURATION_MS: 'tool_call_duration_ms',
    TOOL_CALL_ERRORS_TOTAL: 'tool_call_errors_total',
    LLM_REQUESTS_TOTAL: 'llm_requests_total',
    LLM_TOKENS_INPUT: 'llm_tokens_input',
    LLM_TOKENS_OUTPUT: 'llm_tokens_output',
    LLM_REQUEST_DURATION_MS: 'llm_request_duration_ms',
    CONTEXT_COMPACTIONS_TOTAL: 'context_compactions_total',
    CONTEXT_TOKENS_USED: 'context_tokens_used',
    CIRCUIT_BREAKER_STATE: 'circuit_breaker_state',
};
export class MetricsCollector {
    metrics = new Map();
    incrementCounter(name, value = 1, labels = {}) {
        const existing = this.metrics.get(name);
        if (existing && existing.type === 'counter') {
            existing.value += value;
        }
        else {
            this.metrics.set(name, { type: 'counter', value, labels });
        }
    }
    recordHistogram(name, value, labels = {}) {
        const existing = this.metrics.get(name);
        if (existing && existing.type === 'histogram') {
            existing.values.push(value);
        }
        else {
            this.metrics.set(name, { type: 'histogram', values: [value], labels });
        }
    }
    setGauge(name, value, labels = {}) {
        this.metrics.set(name, { type: 'gauge', value, labels });
    }
    snapshot() {
        const result = {};
        for (const [name, metric] of this.metrics) {
            switch (metric.type) {
                case 'counter':
                    result[name] = { type: 'counter', value: metric.value, labels: metric.labels };
                    break;
                case 'gauge':
                    result[name] = { type: 'gauge', value: metric.value, labels: metric.labels };
                    break;
                case 'histogram': {
                    const sorted = [...metric.values].sort((a, b) => a - b);
                    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
                    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
                    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
                    result[name] = {
                        type: 'histogram',
                        count: sorted.length,
                        min: sorted[0] ?? 0,
                        max: sorted[sorted.length - 1] ?? 0,
                        avg: sorted.reduce((a, b) => a + b, 0) / sorted.length || 0,
                        p50,
                        p95,
                        p99,
                        labels: metric.labels,
                    };
                    break;
                }
            }
        }
        return result;
    }
    reset() {
        this.metrics.clear();
    }
}
//# sourceMappingURL=metrics-collector.js.map