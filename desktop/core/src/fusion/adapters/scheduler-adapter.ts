import { ISchedulerAdapter, SchedulerTask } from './types.js';
import { logger } from '../../utils/logger.js';

export class SchedulerAdapter implements ISchedulerAdapter {
  readonly version = '1.0.0';
  private tasks = new Map<string, SchedulerTask>();
  private nextId = 1;

  async register(task: SchedulerTask): Promise<string> {
    const id = task.id || `sched_${this.nextId++}`;
    this.tasks.set(id, { ...task, id });
    logger.info(`[SchedulerAdapter] task registered: ${id}`);
    return id;
  }

  async unregister(id: string): Promise<boolean> {
    const existed = this.tasks.delete(id);
    if (existed) {
      logger.info(`[SchedulerAdapter] task unregistered: ${id}`);
    }
    return existed;
  }

  async trigger(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`[SchedulerAdapter] task not found: ${id}`);
    }
    if (!task.enabled) {
      logger.warn(`[SchedulerAdapter] task disabled, skip trigger: ${id}`);
      return;
    }
    logger.info(`[SchedulerAdapter] task triggered: ${id}`);
  }

  async list(): Promise<SchedulerTask[]> {
    return Array.from(this.tasks.values());
  }
}

export function createSchedulerAdapter(): SchedulerAdapter {
  return new SchedulerAdapter();
}
