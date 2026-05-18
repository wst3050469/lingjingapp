import { IToolAdapter, IToolRegistry, Tool } from './types.js';
import { logger } from '../../utils/logger.js';

export class ToolAdapter implements IToolAdapter {
  readonly version = '1.0.0';
  private registry: IToolRegistry | null = null;

  setRegistry(registry: IToolRegistry): void {
    this.registry = registry;
    logger.info(`[ToolAdapter] registry set, size: ${registry.size}`);
  }

  register(tool: Tool, mcpServerName?: string): void {
    if (this.registry) {
      this.registry.register(tool, mcpServerName);
    } else {
      logger.warn('[ToolAdapter] no registry configured, register ignored');
    }
  }

  get(name: string): Tool | undefined {
    return this.registry?.get(name);
  }

  has(name: string): boolean {
    return this.registry?.has(name) ?? false;
  }

  getAll(): Tool[] {
    return this.registry?.getAll() ?? [];
  }
}

export function createToolAdapter(registry?: IToolRegistry): ToolAdapter {
  const adapter = new ToolAdapter();
  if (registry) {
    adapter.setRegistry(registry);
  }
  return adapter;
}
