import { logger } from '../utils/logger.js';

export enum CircuitState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half-open',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 1,
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.Closed;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get currentState(): CircuitState {
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

  get failureTotal(): number {
    return this.failureCount;
  }

  get successTotal(): number {
    return this.successCount;
  }

  canExecute(): boolean {
    const state = this.currentState;
    if (state === CircuitState.Closed) return true;
    if (state === CircuitState.HalfOpen) {
      return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    }
    return false;
  }

  recordSuccess(): void {
    this.successCount++;
    if (this.state === CircuitState.HalfOpen) {
      this.state = CircuitState.Closed;
      this.failureCount = 0;
      logger.info('[CircuitBreaker] state transition: half-open -> closed');
    }
  }

  recordFailure(): void {
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

  recordHalfOpenAttempt(): void {
    this.halfOpenAttempts++;
  }

  reset(): void {
    this.state = CircuitState.Closed;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
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
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }
}
