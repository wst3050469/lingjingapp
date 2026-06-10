import { ISkillAdapter, SkillConfig } from './types.js';
import { logger } from '../../utils/logger.js';

export class SkillAdapter implements ISkillAdapter {
  readonly version = '1.0.0';
  private skills = new Map<string, SkillConfig>();
  private loadHandler: ((config: SkillConfig) => Promise<void>) | null = null;

  setLoadHandler(handler: (config: SkillConfig) => Promise<void>): void {
    this.loadHandler = handler;
    logger.info('[SkillAdapter] load handler set');
  }

  async load(config: SkillConfig): Promise<void> {
    this.skills.set(config.name, config);
    if (this.loadHandler) {
      try {
        await this.loadHandler(config);
      } catch (err) {
        logger.warn(`[SkillAdapter] load handler error for "${config.name}": ${(err as Error).message}`);
      }
    }
  }

  async unload(name: string): Promise<void> {
    this.skills.delete(name);
  }

  get(name: string): SkillConfig | undefined {
    return this.skills.get(name);
  }

  getAll(): SkillConfig[] {
    return Array.from(this.skills.values());
  }
}

export function createSkillAdapter(): SkillAdapter {
  return new SkillAdapter();
}
