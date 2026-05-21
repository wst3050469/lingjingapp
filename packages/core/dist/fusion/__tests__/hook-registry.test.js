import { describe, it, expect, beforeEach } from 'vitest';
import { HookRegistry } from '../hook-registry/hook-registry.js';
describe('HookRegistry', () => {
    let reg;
    beforeEach(() => {
        reg = new HookRegistry();
    });
    it('should register a hook and return id', () => {
        const id = reg.register('before_tool_execute', (ctx) => ctx);
        expect(id).toContain('hook_');
    });
    it('should execute registered hooks in priority order', async () => {
        const order = [];
        reg.register('before_tool_execute', (ctx) => { order.push(1); return ctx; }, { priority: 10 });
        reg.register('before_tool_execute', (ctx) => { order.push(2); return ctx; }, { priority: 5 });
        reg.register('before_tool_execute', (ctx) => { order.push(3); return ctx; }, { priority: 0 });
        await reg.execute('before_tool_execute', {});
        expect(order).toEqual([3, 2, 1]);
    });
    it('should pass context through hook chain', async () => {
        reg.register('before_tool_execute', (ctx) => {
            ctx.data = { ...ctx.data, modified: true };
            return ctx;
        });
        const result = await reg.execute('before_tool_execute', { initial: 'data' });
        expect(result.data.modified).toBe(true);
        expect(result.data.initial).toBe('data');
    });
    it('should freeze original data', async () => {
        reg.register('before_tool_execute', (ctx) => ctx);
        const result = await reg.execute('before_tool_execute', { key: 'val' });
        expect(result.original).toEqual({ key: 'val' });
    });
    it('should return context unchanged when no hooks registered', async () => {
        const result = await reg.execute('before_tool_execute', { data: 1 });
        expect(result.data).toEqual({ data: 1 });
    });
    it('should unregister hook by id', () => {
        const id = reg.register('before_tool_execute', (ctx) => ctx);
        expect(reg.unregister(id)).toBe(true);
        expect(reg.unregister('non_existent')).toBe(false);
    });
    it('should skip unregistered hooks during execution', async () => {
        const id = reg.register('before_tool_execute', (ctx) => {
            ctx.data = { ...ctx.data, ran: true };
            return ctx;
        });
        reg.unregister(id);
        const result = await reg.execute('before_tool_execute', {});
        expect(result.data.ran).toBeUndefined();
    });
    it('should handle hook errors gracefully and continue chain', async () => {
        reg.register('before_tool_execute', () => { throw new Error('hook error'); });
        reg.register('before_tool_execute', (ctx) => {
            ctx.data = { ...ctx.data, after_error: true };
            return ctx;
        });
        const result = await reg.execute('before_tool_execute', {});
        expect(result.data.after_error).toBe(true);
    });
    it('should support healthCheck', () => {
        const health = reg.healthCheck();
        expect(health.healthy).toBe(true);
        expect(health.hookCount).toBe(0);
        reg.register('before_tool_execute', (ctx) => ctx);
        expect(reg.healthCheck().hookCount).toBe(1);
    });
    it('should isolate hooks by hook point', async () => {
        const executed = [];
        reg.register('before_tool_execute', (ctx) => { executed.push('tool'); return ctx; });
        reg.register('after_tool_execute', (ctx) => { executed.push('after'); return ctx; });
        await reg.execute('before_tool_execute', {});
        expect(executed).toEqual(['tool']);
    });
    it('should handle async mode hooks', async () => {
        reg.register('before_tool_execute', async (ctx) => {
            ctx.data = { ...ctx.data, async_ran: true };
            return ctx;
        }, { mode: 'async' });
        const result = await reg.execute('before_tool_execute', {});
        expect(result.data.async_ran).toBe(true);
    });
});
//# sourceMappingURL=hook-registry.test.js.map