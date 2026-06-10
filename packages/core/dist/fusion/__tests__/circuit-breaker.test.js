import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../circuit-breaker.js';
describe('CircuitBreaker', () => {
    let cb;
    beforeEach(() => {
        vi.useFakeTimers();
        cb = new CircuitBreaker();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    describe('constructor', () => {
        it('should start in Closed state', () => {
            expect(cb.currentState).toBe(CircuitState.Closed);
        });
        it('should start with zero counters', () => {
            expect(cb.failureTotal).toBe(0);
            expect(cb.successTotal).toBe(0);
        });
        it('should accept custom config', () => {
            const custom = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5000, halfOpenMaxAttempts: 2 });
            expect(custom.config.failureThreshold).toBe(2);
            expect(custom.config.resetTimeoutMs).toBe(5000);
            expect(custom.config.halfOpenMaxAttempts).toBe(2);
        });
        it('should use default config values', () => {
            expect(cb.config.failureThreshold).toBe(5);
            expect(cb.config.resetTimeoutMs).toBe(30000);
            expect(cb.config.halfOpenMaxAttempts).toBe(1);
        });
    });
    describe('state transitions', () => {
        it('should transition to Open after threshold failures', () => {
            const c = new CircuitBreaker({ failureThreshold: 3 });
            expect(c.canExecute()).toBe(true);
            c.recordFailure();
            expect(c.canExecute()).toBe(true);
            c.recordFailure();
            expect(c.canExecute()).toBe(true);
            c.recordFailure();
            expect(c.currentState).toBe(CircuitState.Open);
            expect(c.canExecute()).toBe(false);
        });
        it('should auto-transition to HalfOpen after reset timeout', () => {
            const c = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 10000 });
            c.recordFailure();
            expect(c.currentState).toBe(CircuitState.Open);
            expect(c.canExecute()).toBe(false);
            // Advance time past reset timeout
            vi.advanceTimersByTime(10001);
            expect(c.currentState).toBe(CircuitState.HalfOpen);
            expect(c.canExecute()).toBe(true);
        });
        it('should transition from HalfOpen to Closed on success', () => {
            const c = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
            c.recordFailure();
            expect(c.currentState).toBe(CircuitState.Open);
            // Transition to half-open
            vi.advanceTimersByTime(1001);
            expect(c.currentState).toBe(CircuitState.HalfOpen);
            c.recordSuccess();
            expect(c.currentState).toBe(CircuitState.Closed);
            expect(c.failureTotal).toBe(0);
        });
        it('should transition from HalfOpen back to Open on failure', () => {
            const c = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
            c.recordFailure();
            vi.advanceTimersByTime(1001);
            expect(c.currentState).toBe(CircuitState.HalfOpen);
            c.recordFailure();
            expect(c.currentState).toBe(CircuitState.Open);
            expect(c.canExecute()).toBe(false);
        });
        it('should limit half-open attempts', () => {
            const c = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, halfOpenMaxAttempts: 2 });
            c.recordFailure();
            vi.advanceTimersByTime(1001);
            expect(c.canExecute()).toBe(true);
            c.recordHalfOpenAttempt();
            expect(c.canExecute()).toBe(true);
            c.recordHalfOpenAttempt();
            expect(c.canExecute()).toBe(false);
        });
    });
    describe('execute', () => {
        it('should execute function and record success', async () => {
            const fn = vi.fn().mockResolvedValue('ok');
            const result = await cb.execute(fn);
            expect(result).toBe('ok');
            expect(cb.successTotal).toBe(1);
            expect(cb.failureTotal).toBe(0);
        });
        it('should throw when circuit is open', async () => {
            const c = new CircuitBreaker({ failureThreshold: 1 });
            c.recordFailure();
            await expect(c.execute(async () => 'never')).rejects.toThrow('circuit is open');
        });
        it('should record failure on function error', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('fail'));
            await expect(cb.execute(fn)).rejects.toThrow('fail');
            expect(cb.failureTotal).toBe(1);
        });
        it('should close circuit after success in half-open state', async () => {
            const c = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
            c.recordFailure();
            vi.advanceTimersByTime(1001);
            expect(c.currentState).toBe(CircuitState.HalfOpen);
            const result = await c.execute(async () => 'recovered');
            expect(result).toBe('recovered');
            expect(c.currentState).toBe(CircuitState.Closed);
        });
        it('should reopen circuit on failure in half-open state', async () => {
            const c = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
            c.recordFailure();
            vi.advanceTimersByTime(1001);
            expect(c.currentState).toBe(CircuitState.HalfOpen);
            await expect(c.execute(async () => { throw new Error('still failing'); })).rejects.toThrow('still failing');
            expect(c.currentState).toBe(CircuitState.Open);
        });
    });
    describe('reset', () => {
        it('should reset all state to initial values', () => {
            cb.recordFailure();
            cb.recordSuccess();
            cb.recordSuccess();
            expect(cb.failureTotal).toBe(1);
            expect(cb.successTotal).toBe(2);
            expect(cb.currentState).toBe(CircuitState.Closed);
            cb.reset();
            expect(cb.failureTotal).toBe(0);
            expect(cb.successTotal).toBe(0);
            expect(cb.currentState).toBe(CircuitState.Closed);
        });
    });
    describe('canExecute', () => {
        it('should return true in Closed state', () => {
            expect(cb.canExecute()).toBe(true);
        });
        it('should return false in Open state', () => {
            const c = new CircuitBreaker({ failureThreshold: 1 });
            c.recordFailure();
            expect(c.canExecute()).toBe(false);
        });
        it('should return true in HalfOpen state when under max attempts', () => {
            const c = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
            c.recordFailure();
            vi.advanceTimersByTime(1001);
            expect(c.currentState).toBe(CircuitState.HalfOpen);
            expect(c.canExecute()).toBe(true);
        });
        it('should return false in HalfOpen state when max attempts reached', () => {
            const c = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, halfOpenMaxAttempts: 1 });
            c.recordFailure();
            vi.advanceTimersByTime(1001);
            expect(c.currentState).toBe(CircuitState.HalfOpen);
            c.recordHalfOpenAttempt();
            expect(c.canExecute()).toBe(false);
        });
    });
});
//# sourceMappingURL=circuit-breaker.test.js.map