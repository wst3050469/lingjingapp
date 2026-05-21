import { logger } from '../../utils/logger.js';
import { DEFAULT_MULTI_AGENT_CONFIG } from './types.js';
export class MultiAgentExecutor {
    config;
    eventBus = null;
    executeSingleTask;
    healthy = true;
    constructor(executeSingleTask, config, eventBus) {
        this.config = { ...DEFAULT_MULTI_AGENT_CONFIG, ...config };
        this.executeSingleTask = executeSingleTask;
        if (eventBus)
            this.eventBus = eventBus;
    }
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
    async executeTask(task, context) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.taskTimeout);
        const start = Date.now();
        try {
            const output = await this.executeSingleTask(task, context, controller.signal);
            clearTimeout(timeoutId);
            return {
                taskId: task.taskId,
                status: 'completed',
                output,
                duration: Date.now() - start,
            };
        }
        catch (err) {
            clearTimeout(timeoutId);
            const error = err;
            if (error.name === 'AbortError' || controller.signal.aborted) {
                return {
                    taskId: task.taskId,
                    status: 'timeout',
                    output: '',
                    duration: Date.now() - start,
                    error: 'Task timed out',
                };
            }
            return {
                taskId: task.taskId,
                status: 'failed',
                output: '',
                duration: Date.now() - start,
                error: error.message,
            };
        }
    }
    async execute(tasks, context = {}) {
        const startTime = Date.now();
        if (!this.config.enabled || tasks.length === 0) {
            return {
                results: [],
                failedTasks: [],
                timedOutTasks: [],
                totalTime: Date.now() - startTime,
            };
        }
        const shouldDegrade = this.config.degradeToSequential && this.config.maxConcurrency <= 1;
        const results = [];
        if (shouldDegrade) {
            for (const task of tasks) {
                const result = await this.executeTask(task, context);
                results.push(result);
                logger.info(`[MultiAgentExecutor] sequential: task ${task.taskId} ${result.status}`);
            }
        }
        else {
            const batches = [];
            for (let i = 0; i < tasks.length; i += this.config.maxConcurrency) {
                batches.push(tasks.slice(i, i + this.config.maxConcurrency));
            }
            for (const batch of batches) {
                const batchResults = await Promise.allSettled(batch.map((task) => this.executeTask(task, context)));
                for (let i = 0; i < batchResults.length; i++) {
                    const settled = batchResults[i];
                    if (settled.status === 'fulfilled') {
                        results.push(settled.value);
                    }
                    else {
                        const task = batch[i];
                        results.push({
                            taskId: task.taskId,
                            status: 'failed',
                            output: '',
                            duration: 0,
                            error: settled.reason?.message ?? 'Unknown error',
                        });
                    }
                }
            }
        }
        const failedTasks = results.filter((r) => r.status === 'failed').map((r) => r.taskId);
        const timedOutTasks = results.filter((r) => r.status === 'timeout').map((r) => r.taskId);
        const totalTime = Date.now() - startTime;
        const parallelResult = {
            results,
            failedTasks,
            timedOutTasks,
            totalTime,
        };
        this.eventBus?.publish('parallel:completed', parallelResult, 'MultiAgentExecutor');
        return parallelResult;
    }
    healthCheck() {
        return { healthy: this.healthy };
    }
}
//# sourceMappingURL=multi-agent-executor.js.map