import { IMemoryAdapter } from './types.js';
import { logger } from '../../utils/logger.js';

export class MemoryAdapter implements IMemoryAdapter {
  readonly version = '1.0.0';
  private store = new Map<string, Map<string, unknown>>();
  private writeHandler: ((key: string, value: unknown, scope?: string) => Promise<void>) | null = null;

  setWriteHandler(handler: (key: string, value: unknown, scope?: string) => Promise<void>): void {
    this.writeHandler = handler;
    logger.info('[MemoryAdapter] write handler set');
  }

  private getScope(scope: string = 'default'): Map<string, unknown> {
    if (!this.store.has(scope)) {
      this.store.set(scope, new Map());
    }
    return this.store.get(scope)!;
  }

  async write(key: string, value: unknown, scope?: string): Promise<void> {
    const s = this.getScope(scope);
    s.set(key, value);
    if (this.writeHandler) {
      try {
        await this.writeHandler(key, value, scope);
      } catch (err) {
        logger.warn(`[MemoryAdapter] write handler error: ${(err as Error).message}`);
      }
    }
  }

  async read(key: string, scope?: string): Promise<unknown | undefined> {
    const s = this.getScope(scope);
    return s.get(key);
  }

  async delete(key: string, scope?: string): Promise<void> {
    const s = this.getScope(scope);
    s.delete(key);
  }

  async list(scope?: string): Promise<Array<{ key: string; value: unknown }>> {
    const s = this.getScope(scope);
    return Array.from(s.entries()).map(([key, value]) => ({ key, value }));
  }
}

export function createMemoryAdapter(): MemoryAdapter {
  return new MemoryAdapter();
}
