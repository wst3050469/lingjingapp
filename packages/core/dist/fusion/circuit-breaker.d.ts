export declare enum CircuitState {
    Closed = "closed",
    Open = "open",
    HalfOpen = "half-open"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxAttempts: number;
}
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime;
    private halfOpenAttempts;
    readonly config: CircuitBreakerConfig;
    constructor(config?: Partial<CircuitBreakerConfig>);
    get currentState(): CircuitState;
    get failureTotal(): number;
    get successTotal(): number;
    canExecute(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    recordHalfOpenAttempt(): void;
    reset(): void;
    execute<T>(fn: () => Promise<T>): Promise<T>;
}
//# sourceMappingURL=circuit-breaker.d.ts.map