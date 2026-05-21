/**
 * 批量任务队列
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { BatchTask, BatchStatus, BatchProgress } from '../types';
/**
 * 队列任务
 */
export interface QueueTask extends BatchTask {
    status: BatchStatus;
    addedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: Error;
    retryCount: number;
    maxRetries: number;
}
/**
 * 队列配置
 */
export interface QueueConfig {
    maxConcurrent: number;
    maxRetries: number;
    timeout: number;
    priorityQueue: boolean;
}
/**
 * 批量任务队列
 */
export declare class BatchTaskQueue {
    private queue;
    private running;
    private completed;
    private logger;
    private config;
    private batchId;
    constructor(batchIdOrConfig?: string | {
        maxSize?: number;
        rateLimit?: number;
    }, config?: Partial<QueueConfig>);
    /**
     * 添加任务
     */
    addTask(task: BatchTask, maxRetries?: number): string;
    /**
     * 批量添加任务
     */
    addTasks(tasks: BatchTask[]): string[];
    /**
     * 获取下一个待执行任务
     */
    getNextTask(): QueueTask | undefined;
    /**
     * 标记任务完成
     */
    completeTask(taskId: string, result?: any): void;
    /**
     * 标记任务失败
     */
    failTask(taskId: string, error: Error): void;
    /**
     * 取消任务
     */
    cancelTask(taskId: string): boolean;
    /**
     * 获取进度
     */
    getProgress(): BatchProgress;
    /**
     * 获取当前状态
     */
    private getCurrentStatus;
    /**
     * 获取队列大小
     */
    getQueueSize(): number;
    /**
     * 添加任务（测试兼容别名）
     */
    enqueue(task: BatchTask): Promise<string>;
    /**
     * 获取队列大小（方法版，测试兼容）
     */
    size(): number;
    /**
     * 获取运行中任务数
     */
    getRunningCount(): number;
    /**
     * 获取已完成任务数
     */
    getCompletedCount(): number;
    /**
     * 清空队列
     */
    clear(): void;
}
//# sourceMappingURL=batch-task-queue.d.ts.map