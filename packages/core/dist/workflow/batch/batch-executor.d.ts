/**
 * 批量执行器 - 并行执行
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { BatchTask } from '../types';
import { BatchTaskQueue } from './batch-task-queue';
import { RateLimiter } from './rate-limiter';
/**
 * 执行器配置
 */
export interface ExecutorConfig {
    maxConcurrent: number;
    timeout: number;
    retryDelay: number;
}
/**
 * 执行结果
 */
export interface ExecutionResult {
    taskId: string;
    success: boolean;
    result?: any;
    error?: Error;
    duration: number;
    retryCount: number;
}
/**
 * 批量执行器
 */
export declare class BatchExecutor {
    private queue;
    private logger;
    private config;
    private rateLimiter?;
    private isRunning;
    private abortController?;
    constructor(queueOrConfig?: BatchTaskQueue | Partial<ExecutorConfig>, config?: Partial<ExecutorConfig>, rateLimiter?: RateLimiter);
    /**
     * 执行任务列表（测试兼容：匹配 test 的 execute(tasks, processor) 格式）
     */
    execute<T extends BatchTask, R>(tasks: T[], processor: (task: T) => Promise<R>): Promise<R[]>;
    /**
     * 开始执行
     */
    start(): Promise<void>;
    /**
     * 停止执行
     */
    stop(): void;
    /**
     * 执行单个任务
     */
    private executeTask;
    /**
     * 带超时的执行
     */
    private executeWithTimeout;
    /**
     * 延迟
     */
    private delay;
    /**
     * 获取执行状态
     */
    getStatus(): {
        isRunning: boolean;
        runningCount: number;
        queueSize: number;
    };
}
//# sourceMappingURL=batch-executor.d.ts.map