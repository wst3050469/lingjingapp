import { logger } from '../utils/logger.js';
export var CircuitState;
(function (CircuitState) {
    CircuitState["Closed"] = "closed";
    CircuitState["Open"] = "open";
    CircuitState["HalfOpen"] = "half-open";
})(CircuitState || (CircuitState = {}));
const DEFAULT_CONFIG = {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 1,
};
export class CircuitBreaker {
    state = CircuitState.Closed;
    failureCount = 0;
    successCount = 0;
    lastFailureTime = 0;
    halfOpenAttempts = 0;
    config;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    get currentState() {
        if (this.state === CircuitState.Open) {
            const elapsed = Date.now() - this.lastFailureTime;
            if (elapsed >= this.config.resetTimeoutMs) {
                this.state = CircuitState.HalfOpen;
                this.halfOpenAttempts = 0;
                logger.info('[CircuitBreaker] state transition: open -> half-open');
            }
        }
        return this.state;
    }
    get failureTotal() {
        return this.failureCount;
    }
    get successTotal() {
        return this.successCount;
    }
    canExecute() {
        const state = this.currentState;
        if (state === CircuitState.Closed)
            return true;
        if (state === CircuitState.HalfOpen) {
            return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
        }
        return false;
    }
    recordSuccess() {
        this.successCount++;
        if (this.state === CircuitState.HalfOpen) {
            this.state = CircuitState.Closed;
            this.failureCount = 0;
            logger.info('[CircuitBreaker] state transition: half-open -> closed');
        }
    }
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.HalfOpen) {
            this.state = CircuitState.Open;
            logger.info('[CircuitBreaker] state transition: half-open -> open');
            return;
        }
        if (this.failureCount >= this.config.failureThreshold) {
            this.state = CircuitState.Open;
            logger.info(`[CircuitBreaker] state transition: closed -> open (failures: ${this.failureCount})`);
        }
    }
    recordHalfOpenAttempt() {
        this.halfOpenAttempts++;
    }
    reset() {
        this.state = CircuitState.Closed;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        this.halfOpenAttempts = 0;
    }
    async execute(fn) {
        if (!this.canExecute()) {
            throw new Error(`[CircuitBreaker] circuit is ${this.currentState}, execution blocked`);
        }
        if (this.currentState === CircuitState.HalfOpen) {
            this.recordHalfOpenAttempt();
        }
        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        }
        catch (err) {
            this.recordFailure();
            throw err;
        }
    }
}
//# sourceMappingURL=circuit-breaker.js.map