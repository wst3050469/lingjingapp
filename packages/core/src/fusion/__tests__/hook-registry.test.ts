import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookRegistry } from '../hook-registry/hook-registry.js';
import type { HookPoint } from '../hook-registry/types.js';

describe('HookRegistry', () => {
  let reg: HookRegistry;

  beforeEach(() => {
    reg = new HookRegistry();
  });

  it('should register a hook and return id', () => {
    const id = reg.register('before_tool_execute' as HookPoint, (ctx) => ctx);
    expect(id).toContain('hook_');
  });

  it('should execute registered hooks in priority order', async () => {
    const order: number[] = [];
    reg.register('before_tool_execute' as HookPoint, (ctx) => { order.push(1); return ctx; }, { priority: 10 });
    reg.register('before_tool_execute' as HookPoint, (ctx) => { order.push(2); return ctx; }, { priority: 5 });
    reg.register('before_tool_execute' as HookPoint, (ctx) => { order.push(3); return ctx; }, { priority: 0 });
    await reg.execute('before_tool_execute' as HookPoint, {});
    expect(order).toEqual([3, 2, 1]);
  });

  it('should pass context through hook chain', async () => {
    reg.register('before_tool_execute' as HookPoint, (ctx) => {
      ctx.data = { ...(ctx.data as any), modified: true };
      return ctx;
    });
    const result = await reg.execute('before_tool_execute' as HookPoint, { initial: 'data' });
    expect((result.data as any).modified).toBe(true);
    expect((result.data as any).initial).toBe('data');
  });

  it('should freeze original data', async () => {
    reg.register('before_tool_execute' as HookPoint, (ctx) => ctx);
    const result = await reg.execute('before_tool_execute' as HookPoint, { key: 'val' });
    expect(result.original).toEqual({ key: 'val' });
  });

  it('should return context unchanged when no hooks registered', async () => {
    const result = await reg.execute('before_tool_execute' as HookPoint, { data: 1 });
    expect(result.data).toEqual({ data: 1 });
  });

  it('should unregister hook by id', () => {
    const id = reg.register('before_tool_execute' as HookPoint, (ctx) => ctx);
    expect(reg.unregister(id)).toBe(true);
    expect(reg.unregister('non_existent')).toBe(false);
  });

  it('should skip unregistered hooks during execution', async () => {
    const id = reg.register('before_tool_execute' as HookPoint, (ctx) => {
      ctx.data = { ...(ctx.data as any), ran: true };
      return ctx;
    });
    reg.unregister(id);
    const result = await reg.execute('before_tool_execute' as HookPoint, {});
    expect((result.data as any).ran).toBeUndefined();
  });

  it('should handle hook errors gracefully and continue chain', async () => {
    reg.register('before_tool_execute' as HookPoint, () => { throw new Error('hook error'); });
    reg.register('before_tool_execute' as HookPoint, (ctx) => {
      ctx.data = { ...(ctx.data as any), after_error: true };
      return ctx;
    });
    const result = await reg.execute('before_tool_execute' as HookPoint, {});
    expect((result.data as any).after_error).toBe(true);
  });

  it('should support healthCheck', () => {
    const health = reg.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.hookCount).toBe(0);
    reg.register('before_tool_execute' as HookPoint, (ctx) => ctx);
    expect(reg.healthCheck().hookCount).toBe(1);
  });

  it('should isolate hooks by hook point', async () => {
    const executed: string[] = [];
    reg.register('before_tool_execute' as HookPoint, (ctx) => { executed.push('tool'); return ctx; });
    reg.register('after_tool_execute' as HookPoint, (ctx) => { executed.push('after'); return ctx; });
    await reg.execute('before_tool_execute' as HookPoint, {});
    expect(executed).toEqual(['tool']);
  });

  it('should handle async mode hooks', async () => {
    reg.register('before_tool_execute' as HookPoint, async (ctx) => {
      ctx.data = { ...(ctx.data as any), async_ran: true };
      return ctx;
    }, { mode: 'async' });
    const result = await reg.execute('before_tool_execute' as HookPoint, {});
    expect((result.data as any).async_ran).toBe(true);
  });
});
