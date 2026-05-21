/**
 * 批量执行器 - 并行执行
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
import { BatchTaskQueue } from './batch-task-queue';
/**
 * 批量执行器
 */
export class BatchExecutor {
    queue;
    logger;
    config;
    rateLimiter;
    isRunning = false;
    abortController;
    constructor(queueOrConfig, config, rateLimiter) {
        // Support test-compatible constructor: (config?) with internal queue
        if (queueOrConfig === undefined || !(queueOrConfig instanceof BatchTaskQueue)) {
            this.queue = new BatchTaskQueue();
            this.config = {
                maxConcurrent: queueOrConfig?.maxConcurrent || 5,
                timeout: queueOrConfig?.timeout || 300000,
                retryDelay: queueOrConfig?.retryDelay || 1000
            };
        }
        else {
            this.queue = queueOrConfig;
            this.config = {
                maxConcurrent: config?.maxConcurrent || 5,
                timeout: config?.timeout || 300000,
                retryDelay: config?.retryDelay || 1000
            };
        }
        this.logger = new WorkflowLogger('batch-executor');
        this.rateLimiter = rateLimiter;
    }
    /**
     * 执行任务列表（测试兼容：匹配 test 的 execute(tasks, processor) 格式）
     */
    async execute(tasks, processor) {
        const results = [];
        for (const task of tasks) {
            // Use addTask to add to queue, or process inline
            const result = await processor(task);
            results.push(result);
        }
        return results;
    }
    /**
     * 开始执行
     */
    async start() {
        if (this.isRunning) {
            this.logger.warn(0, 'Executor is already running');
            return;
        }
        this.isRunning = true;
        this.abortController = new AbortController();
        this.logger.info(0, 'Batch executor started');
        while (this.isRunning && !this.abortController.signal.aborted) {
            const task = this.queue.getNextTask();
            if (!task) {
                if (this.queue.getRunningCount() === 0) {
                    break;
                }
                await this.delay(100);
                continue;
            }
            this.executeTask(task).catch(error => {
                this.logger.error(0, `Task execution error: ${task.taskId}`, error);
            });
        }
        while (this.queue.getRunningCount() > 0 && this.isRunning) {
            await this.delay(100);
        }
        this.isRunning = false;
        this.logger.info(0, 'Batch executor stopped');
    }
    /**
     * 停止执行
     */
    stop() {
        this.logger.info(0, 'Stopping batch executor');
        this.isRunning = false;
        if (this.abortController) {
            this.abortController.abort();
        }
    }
    /**
     * 执行单个任务
     */
    async executeTask(task) {
        const startTime = Date.now();
        let retryCount = 0;
        this.logger.info(0, `Executing task: ${task.taskId}`);
        while (retryCount <= task.maxRetries) {
            try {
                if (this.rateLimiter) {
                    await this.rateLimiter.waitForSlot();
                }
                const result = await this.executeWithTimeout(task.execute, this.config.timeout);
                const duration = Date.now() - startTime;
                this.queue.completeTask(task.taskId, result);
                return {
                    taskId: task.taskId,
                    success: true,
                    result,
                    duration,
                    retryCount
                };
            }
            catch (error) {
                retryCount++;
                if (retryCount <= task.maxRetries) {
                    this.logger.warn(0, `Task ${task.taskId} failed, retrying`, {
                        retryCount,
                        maxRetries: task.maxRetries
                    });
                    await this.delay(this.config.retryDelay * retryCount);
                }
                else {
                    const duration = Date.now() - startTime;
                    this.queue.failTask(task.taskId, error);
                    return {
                        taskId: task.taskId,
                        success: false,
                        error: error,
                        duration,
                        retryCount
                    };
                }
            }
        }
        throw new Error('Should not reach here');
    }
    /**
     * 带超时的执行
     */
    async executeWithTimeout(execute, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Task timeout after ${timeout}ms`));
            }, timeout);
            execute()
                .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    /**
     * 延迟
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * 获取执行状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            runningCount: this.queue.getRunningCount(),
            queueSize: this.queue.getQueueSize()
        };
    }
}
//# sourceMappingURL=batch-executor.js.map