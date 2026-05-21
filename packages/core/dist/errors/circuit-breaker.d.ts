export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    cooldownMs: number;
    halfOpenMaxAttempts: number;
    onStateChange?: (from: CircuitState, to: CircuitState) => void;
}
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime;
    private halfOpenAttempts;
    private readonly config;
    constructor(config?: Partial<CircuitBreakerConfig>);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    getState(): CircuitState;
    getFailureCount(): number;
    getStats(): {
        state: CircuitState;
        failureCount: number;
        successCount: number;
        lastFailureTime: number;
    };
    reset(): void;
    private onSuccess;
    private onFailure;
    private transitionTo;
}
//# sourceMappingURL=circuit-breaker.d.ts.map