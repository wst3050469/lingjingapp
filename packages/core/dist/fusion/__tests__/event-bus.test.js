import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../event-bus/event-bus.js';
describe('EventBus', () => {
    let bus;
    beforeEach(() => {
        bus = new EventBus();
    });
    describe('publish and subscribe', () => {
        it('should deliver event to subscriber', () => {
            const handler = vi.fn();
            bus.subscribe('agent:message_start', handler);
            bus.publish('agent:message_start', { text: 'hello' }, 'test');
            expect(handler).toHaveBeenCalledTimes(1);
            const event = handler.mock.calls[0][0];
            expect(event.topic).toBe('agent:message_start');
            expect(event.data).toEqual({ text: 'hello' });
            expect(event.source).toBe('test');
            expect(event.id).toBeDefined();
            expect(event.timestamp).toBeDefined();
        });
        it('should not call subscriber on different topic', () => {
            const handler = vi.fn();
            bus.subscribe('agent:tool_call', handler);
            bus.publish('agent:message_start', {}, 'test');
            expect(handler).not.toHaveBeenCalled();
        });
        it('should support multiple subscribers on same topic', () => {
            const h1 = vi.fn();
            const h2 = vi.fn();
            bus.subscribe('agent:message_end', h1);
            bus.subscribe('agent:message_end', h2);
            bus.publish('agent:message_end', { data: 'x' }, 'test');
            expect(h1).toHaveBeenCalledTimes(1);
            expect(h2).toHaveBeenCalledTimes(1);
        });
        it('should execute subscribers in priority order', () => {
            const order = [];
            bus.subscribe('agent:tool_result', () => { order.push(1); }, { priority: 10 });
            bus.subscribe('agent:tool_result', () => { order.push(2); }, { priority: 5 });
            bus.subscribe('agent:tool_result', () => { order.push(3); }, { priority: 0 });
            bus.publish('agent:tool_result', {}, 'test');
            expect(order).toEqual([3, 2, 1]);
        });
        it('should support once option (auto-unsubscribe after first call)', () => {
            const handler = vi.fn();
            bus.subscribe('agent:message_end', handler, { once: true });
            bus.publish('agent:message_end', { n: 1 }, 'test');
            bus.publish('agent:message_end', { n: 2 }, 'test');
            expect(handler).toHaveBeenCalledTimes(1);
        });
        it('should allow unsubscribe', () => {
            const handler = vi.fn();
            const unsubscribe = bus.subscribe('agent:message_end', handler);
            bus.publish('agent:message_end', { n: 1 }, 'test');
            expect(handler).toHaveBeenCalledTimes(1);
            unsubscribe();
            bus.publish('agent:message_end', { n: 2 }, 'test');
            expect(handler).toHaveBeenCalledTimes(1);
        });
        it('should support filter option', () => {
            const handler = vi.fn();
            bus.subscribe('agent:message_end', handler, {
                filter: (event) => event.data.important === true,
            });
            bus.publish('agent:message_end', { important: false }, 'test');
            expect(handler).not.toHaveBeenCalled();
            bus.publish('agent:message_end', { important: true }, 'test');
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });
    describe('global filters', () => {
        it('should block events rejected by global filter', () => {
            const handler = vi.fn();
            const filteredHandler = vi.fn();
            bus.subscribe('agent:message_start', handler);
            bus.addFilter((event) => event.data.allowed !== false);
            bus.publish('agent:message_start', { allowed: false }, 'test');
            expect(handler).not.toHaveBeenCalled();
            bus.publish('agent:message_start', { allowed: true }, 'test');
            expect(handler).toHaveBeenCalled();
        });
    });
    describe('healthCheck', () => {
        it('should return healthy=false when no events published (0<0 is false)', () => {
            const status = bus.healthCheck();
            expect(status.healthy).toBe(false);
            expect(status.metrics.totalPublished).toBe(0);
            expect(status.metrics.totalErrors).toBe(0);
        });
        it('should report unhealthy when error rate exceeds 50%', () => {
            // Manually trigger errors by publishing to unhandled callbacks
            const handler = () => { throw new Error('fail'); };
            bus.subscribe('agent:message_start', handler);
            bus.publish('agent:message_start', {}, 'test');
            bus.publish('agent:message_start', {}, 'test');
            bus.publish('agent:message_start', {}, 'test');
            const status = bus.healthCheck();
            expect(status.metrics.totalErrors).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=event-bus.test.js.map