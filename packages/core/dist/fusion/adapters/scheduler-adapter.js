import { logger } from '../../utils/logger.js';
export class SchedulerAdapter {
    version = '1.0.0';
    tasks = new Map();
    nextId = 1;
    async register(task) {
        const id = task.id || `sched_${this.nextId++}`;
        this.tasks.set(id, { ...task, id });
        logger.info(`[SchedulerAdapter] task registered: ${id}`);
        return id;
    }
    async unregister(id) {
        const existed = this.tasks.delete(id);
        if (existed) {
            logger.info(`[SchedulerAdapter] task unregistered: ${id}`);
        }
        return existed;
    }
    async trigger(id) {
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
    async list() {
        return Array.from(this.tasks.values());
    }
}
export function createSchedulerAdapter() {
    return new SchedulerAdapter();
}
//# sourceMappingURL=scheduler-adapter.js.map