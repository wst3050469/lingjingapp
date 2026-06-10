export var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
const DEFAULT_CONFIG = {
    failureThreshold: 5,
    cooldownMs: 30000,
    halfOpenMaxAttempts: 1,
};
export class CircuitBreaker {
    state = CircuitState.CLOSED;
    failureCount = 0;
    successCount = 0;
    lastFailureTime = 0;
    halfOpenAttempts = 0;
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    async execute(fn) {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime >= this.config.cooldownMs) {
                this.transitionTo(CircuitState.HALF_OPEN);
                this.halfOpenAttempts = 0;
            }
            else {
                throw new Error(`Circuit breaker is OPEN (failures: ${this.failureCount}, cooldown remaining: ${Math.max(0, this.config.cooldownMs - (Date.now() - this.lastFailureTime))}ms)`);
            }
        }
        if (this.state === CircuitState.HALF_OPEN && this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
            throw new Error('Circuit breaker is HALF_OPEN and max试探 attempts reached');
        }
        try {
            if (this.state === CircuitState.HALF_OPEN) {
                this.halfOpenAttempts++;
            }
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    getState() {
        return this.state;
    }
    getFailureCount() {
        return this.failureCount;
    }
    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
        };
    }
    reset() {
        this.failureCount = 0;
        this.successCount = 0;
        this.transitionTo(CircuitState.CLOSED);
    }
    onSuccess() {
        this.successCount++;
        if (this.state === CircuitState.HALF_OPEN) {
            this.failureCount = 0;
            this.transitionTo(CircuitState.CLOSED);
        }
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.OPEN);
        }
        else if (this.failureCount >= this.config.failureThreshold) {
            this.transitionTo(CircuitState.OPEN);
        }
    }
    transitionTo(newState) {
        const oldState = this.state;
        if (oldState === newState)
            return;
        this.state = newState;
        this.config.onStateChange?.(oldState, newState);
    }
}
//# sourceMappingURL=circuit-breaker.js.map