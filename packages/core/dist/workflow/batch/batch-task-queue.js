/**
 * 批量任务队列
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
import { BatchStatus } from '../types';
/**
 * 批量任务队列
 */
export class BatchTaskQueue {
    queue = [];
    running = new Map();
    completed = [];
    logger;
    config;
    batchId;
    constructor(batchIdOrConfig, config) {
        // Support test-compatible constructor: (config?) with auto-generated batchId
        if (typeof batchIdOrConfig === 'object' || batchIdOrConfig === undefined) {
            this.batchId = `batch-${Date.now()}`;
            this.logger = new WorkflowLogger(`batch-queue-${this.batchId}`);
            this.config = {
                maxConcurrent: 5,
                maxRetries: 3,
                timeout: 300000,
                priorityQueue: true
            };
        }
        else {
            this.batchId = batchIdOrConfig;
            this.logger = new WorkflowLogger(`batch-queue-${batchIdOrConfig}`);
            this.config = {
                maxConcurrent: config?.maxConcurrent || 5,
                maxRetries: config?.maxRetries || 3,
                timeout: config?.timeout || 300000,
                priorityQueue: config?.priorityQueue || true
            };
        }
    }
    /**
     * 添加任务
     */
    addTask(task, maxRetries) {
        const queueTask = {
            ...task,
            status: BatchStatus.PENDING,
            addedAt: new Date(),
            retryCount: 0,
            maxRetries: maxRetries || this.config.maxRetries
        };
        this.queue.push(queueTask);
        if (this.config.priorityQueue) {
            this.queue.sort((a, b) => b.priority - a.priority);
        }
        this.logger.info(0, `Task added to queue: ${task.taskId}`, {
            priority: task.priority,
            queueSize: this.queue.length
        });
        return task.taskId;
    }
    /**
     * 批量添加任务
     */
    addTasks(tasks) {
        const taskIds = [];
        for (const task of tasks) {
            const taskId = this.addTask(task);
            taskIds.push(taskId);
        }
        return taskIds;
    }
    /**
     * 获取下一个待执行任务
     */
    getNextTask() {
        if (this.queue.length === 0) {
            return undefined;
        }
        if (this.running.size >= this.config.maxConcurrent) {
            return undefined;
        }
        const task = this.queue.shift();
        if (task) {
            task.status = BatchStatus.RUNNING;
            task.startedAt = new Date();
            this.running.set(task.taskId, task);
        }
        return task;
    }
    /**
     * 标记任务完成
     */
    completeTask(taskId, result) {
        const task = this.running.get(taskId);
        if (!task) {
            this.logger.warn(0, `Task not found in running queue: ${taskId}`);
            return;
        }
        task.status = BatchStatus.COMPLETED;
        task.completedAt = new Date();
        this.running.delete(taskId);
        this.completed.push(task);
        this.logger.info(0, `Task completed: ${taskId}`, {
            duration: task.completedAt.getTime() - (task.startedAt?.getTime() || 0)
        });
    }
    /**
     * 标记任务失败
     */
    failTask(taskId, error) {
        const task = this.running.get(taskId);
        if (!task) {
            this.logger.warn(0, `Task not found in running queue: ${taskId}`);
            return;
        }
        task.error = error;
        task.retryCount++;
        if (task.retryCount < task.maxRetries) {
            task.status = BatchStatus.PENDING;
            this.running.delete(taskId);
            this.queue.unshift(task);
            this.logger.warn(0, `Task failed, requeued for retry: ${taskId}`, {
                retryCount: task.retryCount,
                maxRetries: task.maxRetries
            });
        }
        else {
            task.status = BatchStatus.FAILED;
            task.completedAt = new Date();
            this.running.delete(taskId);
            this.completed.push(task);
            this.logger.error(0, `Task failed permanently: ${taskId}`, error);
        }
    }
    /**
     * 取消任务
     */
    cancelTask(taskId) {
        const queueIndex = this.queue.findIndex(t => t.taskId === taskId);
        if (queueIndex !== -1) {
            const task = this.queue.splice(queueIndex, 1)[0];
            task.status = BatchStatus.CANCELLED;
            task.completedAt = new Date();
            this.completed.push(task);
            this.logger.info(0, `Task cancelled: ${taskId}`);
            return true;
        }
        const runningTask = this.running.get(taskId);
        if (runningTask) {
            runningTask.status = BatchStatus.CANCELLED;
            runningTask.completedAt = new Date();
            this.running.delete(taskId);
            this.completed.push(runningTask);
            this.logger.info(0, `Running task cancelled: ${taskId}`);
            return true;
        }
        return false;
    }
    /**
     * 获取进度
     */
    getProgress() {
        const totalTasks = this.queue.length + this.running.size + this.completed.length;
        const completedTasks = this.completed.filter(t => t.status === BatchStatus.COMPLETED).length;
        const failedTasks = this.completed.filter(t => t.status === BatchStatus.FAILED).length;
        return {
            batchId: this.batchId,
            totalTasks,
            completedTasks,
            failedTasks,
            progressPercentage: totalTasks > 0
                ? Math.round((completedTasks / totalTasks) * 100)
                : 0,
            status: this.getCurrentStatus()
        };
    }
    /**
     * 获取当前状态
     */
    getCurrentStatus() {
        if (this.running.size > 0) {
            return BatchStatus.RUNNING;
        }
        if (this.queue.length > 0) {
            return BatchStatus.PENDING;
        }
        const hasFailures = this.completed.some(t => t.status === BatchStatus.FAILED);
        if (hasFailures) {
            return BatchStatus.FAILED;
        }
        return BatchStatus.COMPLETED;
    }
    /**
     * 获取队列大小
     */
    getQueueSize() {
        return this.queue.length;
    }
    /**
     * 添加任务（测试兼容别名）
     */
    async enqueue(task) {
        return this.addTask(task);
    }
    /**
     * 获取队列大小（方法版，测试兼容）
     */
    size() {
        return this.queue.length + this.running.size;
    }
    /**
     * 获取运行中任务数
     */
    getRunningCount() {
        return this.running.size;
    }
    /**
     * 获取已完成任务数
     */
    getCompletedCount() {
        return this.completed.length;
    }
    /**
     * 清空队列
     */
    clear() {
        this.queue = [];
        this.running.clear();
        this.completed = [];
        this.logger.info(0, 'Queue cleared');
    }
}
//# sourceMappingURL=batch-task-queue.js.map