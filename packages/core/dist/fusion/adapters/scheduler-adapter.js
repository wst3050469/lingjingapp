"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerAdapter = void 0;
exports.createSchedulerAdapter = createSchedulerAdapter;
const logger_js_1 = require("../../utils/logger.js");
class SchedulerAdapter {
    version = '1.0.0';
    tasks = new Map();
    nextId = 1;
    async register(task) {
        const id = task.id || `sched_${this.nextId++}`;
        this.tasks.set(id, { ...task, id });
        logger_js_1.logger.info(`[SchedulerAdapter] task registered: ${id}`);
        return id;
    }
    async unregister(id) {
        const existed = this.tasks.delete(id);
        if (existed) {
            logger_js_1.logger.info(`[SchedulerAdapter] task unregistered: ${id}`);
        }
        return existed;
    }
    async trigger(id) {
        const task = this.tasks.get(id);
        if (!task) {
            throw new Error(`[SchedulerAdapter] task not found: ${id}`);
        }
        if (!task.enabled) {
            logger_js_1.logger.warn(`[SchedulerAdapter] task disabled, skip trigger: ${id}`);
            return;
        }
        logger_js_1.logger.info(`[SchedulerAdapter] task triggered: ${id}`);
    }
    async list() {
        return Array.from(this.tasks.values());
    }
}
exports.SchedulerAdapter = SchedulerAdapter;
function createSchedulerAdapter() {
    return new SchedulerAdapter();
}
//# sourceMappingURL=scheduler-adapter.js.map