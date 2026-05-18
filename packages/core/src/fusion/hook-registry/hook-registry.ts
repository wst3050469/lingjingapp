import { HookPoint, HookContext, HookCallback, HookOptions, HookEntry, IHookRegistry } from './types.js';
import { logger } from '../../utils/logger.js';

const DEFAULT_TIMEOUT = 100;

function generateHookId(): string {
  return `hook_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('hook timeout')), ms)
    ),
  ]);
}

export class HookRegistry implements IHookRegistry {
  private hooks = new Map<HookPoint, HookEntry[]>();
  private hookById = new Map<string, HookEntry>();

  register<T>(point: HookPoint, callback: HookCallback<T>, options?: HookOptions): string {
    const id = generateHookId();
    const entry: HookEntry = {
      id,
      point,
      callback: callback as HookCallback,
      options: {
        priority: options?.priority ?? 0,
        mode: options?.mode ?? 'sync',
        timeout: options?.timeout ?? DEFAULT_TIMEOUT,
      },
    };

    this.hookById.set(id, entry);

    if (!this.hooks.has(point)) {
      this.hooks.set(point, []);
    }

    const list = this.hooks.get(point)!;
    list.push(entry);
    list.sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0));

    return id;
  }

  unregister(id: string): boolean {
    const entry = this.hookById.get(id);
    if (!entry) return false;

    const list = this.hooks.get(entry.point);
    if (list) {
      const idx = list.findIndex((e) => e.id === id);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        this.hooks.delete(entry.point);
      }
    }

    this.hookById.delete(id);
    return true;
  }

  async execute<T>(point: HookPoint, data: T): Promise<HookContext<T>> {
    const context: HookContext<T> = {
      point,
      data,
      original: Object.freeze(structuredClone(data) ?? data) as Readonly<T>,
    };

    const entries = this.hooks.get(point);
    if (!entries || entries.length === 0) {
      return context;
    }

    let current = context;

    for (const entry of entries) {
      try {
        const timeout = entry.options.timeout ?? DEFAULT_TIMEOUT;

        if (entry.options.mode === 'async') {
          const result = await withTimeout(
            Promise.resolve(entry.callback(current as HookContext)),
            timeout
          );
          current = result as HookContext<T>;
        } else {
          const result = await withTimeout(
            Promise.resolve(entry.callback(current as HookContext)),
            timeout
          );
          current = result as HookContext<T>;
        }
      } catch (err) {
        logger.warn(`[HookRegistry] hook "${entry.id}" at "${point}" failed: ${(err as Error).message}`);
      }
    }

    return current;
  }

  healthCheck(): { healthy: boolean; hookCount: number } {
    return {
      healthy: true,
      hookCount: this.hookById.size,
    };
  }
}
