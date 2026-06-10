/**
 * 批量监控
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { BatchTaskQueue } from './batch-task-queue';
import { BatchExecutor } from './batch-executor';
import { TaskResult } from './result-aggregator';
/**
 * 监控指标
 */
export interface MonitorMetrics {
    batchId: string;
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
    progress: {
        total: number;
        completed: number;
        failed: number;
        percentage: number;
    };
    performance: {
        throughput: number;
        avgExecutionTime: number;
        estimatedTimeRemaining: number;
    };
    resources: {
        queueSize: number;
        runningCount: number;
        waitingCount: number;
    };
    timestamp: Date;
}
/**
 * 监控事件
 */
export interface MonitorEvent {
    type: 'TASK_STARTED' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'BATCH_COMPLETED';
    taskId?: string;
    data?: any;
    timestamp: Date;
}
/**
 * 监控回调
 */
export type MonitorCallback = (metrics: MonitorMetrics) => void;
/**
 * 批量监控
 */
export declare class BatchMonitor {
    private logger;
    private queue;
    private executor;
    private aggregator;
    private startTime;
    private completedCount;
    private eventListeners;
    private monitorInterval?;
    constructor(batchId: string, queue: BatchTaskQueue, executor: BatchExecutor);
    /**
     * 开始监控
     */
    start(): void;
    /**
     * 停止监控
     */
    stop(): void;
    /**
     * 记录任务结果
     */
    recordTaskResult(result: TaskResult): void;
    /**
     * 添加监控监听器
     */
    addListener(callback: MonitorCallback): void;
    /**
     * 移除监控监听器
     */
    removeListener(callback: MonitorCallback): void;
    /**
     * 收集指标
     */
    private collectMetrics;
    /**
     * 计算平均执行时间
     */
    private calculateAverageExecutionTime;
    /**
     * 映射状态
     */
    private mapStatus;
    /**
     * 通知监听器
     */
    private notifyListeners;
    /**
     * 获取聚合结果
     */
    getAggregatedResult(): import("./result-aggregator").AggregatedResult;
    /**
     * 获取当前指标
     */
    getCurrentMetrics(): MonitorMetrics;
}
//# sourceMappingURL=batch-monitor.d.ts.map