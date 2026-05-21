/**
 * 批量监控
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
import { ResultAggregator } from './result-aggregator';
/**
 * 批量监控
 */
export class BatchMonitor {
    logger;
    queue;
    executor;
    aggregator;
    startTime = 0;
    completedCount = 0;
    eventListeners = [];
    monitorInterval;
    constructor(batchId, queue, executor) {
        this.logger = new WorkflowLogger(`batch-monitor-${batchId}`);
        this.queue = queue;
        this.executor = executor;
        this.aggregator = new ResultAggregator(batchId);
    }
    /**
     * 开始监控
     */
    start() {
        this.startTime = Date.now();
        this.completedCount = 0;
        this.monitorInterval = setInterval(() => {
            this.collectMetrics();
        }, 1000);
        this.logger.info(0, 'Batch monitor started');
    }
    /**
     * 停止监控
     */
    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = undefined;
        }
        this.logger.info(0, 'Batch monitor stopped');
    }
    /**
     * 记录任务结果
     */
    recordTaskResult(result) {
        this.aggregator.addResult(result);
        if (result.success) {
            this.completedCount++;
        }
    }
    /**
     * 添加监控监听器
     */
    addListener(callback) {
        this.eventListeners.push(callback);
    }
    /**
     * 移除监控监听器
     */
    removeListener(callback) {
        const index = this.eventListeners.indexOf(callback);
        if (index !== -1) {
            this.eventListeners.splice(index, 1);
        }
    }
    /**
     * 收集指标
     */
    collectMetrics() {
        const progress = this.queue.getProgress();
        const executorStatus = this.executor.getStatus();
        const elapsed = (Date.now() - this.startTime) / 1000;
        const throughput = elapsed > 0 ? this.completedCount / elapsed : 0;
        const avgExecutionTime = this.calculateAverageExecutionTime();
        const remainingTasks = progress.totalTasks - progress.completedTasks;
        const estimatedTimeRemaining = throughput > 0
            ? remainingTasks / throughput
            : 0;
        const metrics = {
            batchId: progress.batchId,
            status: this.mapStatus(progress.status),
            progress: {
                total: progress.totalTasks,
                completed: progress.completedTasks,
                failed: progress.failedTasks,
                percentage: progress.progressPercentage
            },
            performance: {
                throughput: Math.round(throughput * 100) / 100,
                avgExecutionTime,
                estimatedTimeRemaining: Math.round(estimatedTimeRemaining)
            },
            resources: {
                queueSize: executorStatus.queueSize,
                runningCount: executorStatus.runningCount,
                waitingCount: 0
            },
            timestamp: new Date()
        };
        this.notifyListeners(metrics);
    }
    /**
     * 计算平均执行时间
     */
    calculateAverageExecutionTime() {
        const stats = this.aggregator.calculateStatistics();
        return stats.avgDuration;
    }
    /**
     * 映射状态
     */
    mapStatus(status) {
        switch (status) {
            case 'RUNNING':
                return 'RUNNING';
            case 'PENDING':
                return 'PAUSED';
            case 'COMPLETED':
                return 'COMPLETED';
            case 'FAILED':
                return 'FAILED';
            default:
                return 'PAUSED';
        }
    }
    /**
     * 通知监听器
     */
    notifyListeners(metrics) {
        for (const callback of this.eventListeners) {
            try {
                callback(metrics);
            }
            catch (error) {
                this.logger.error(0, 'Monitor listener error', error);
            }
        }
    }
    /**
     * 获取聚合结果
     */
    getAggregatedResult() {
        return this.aggregator.aggregate();
    }
    /**
     * 获取当前指标
     */
    getCurrentMetrics() {
        const progress = this.queue.getProgress();
        const executorStatus = this.executor.getStatus();
        const elapsed = (Date.now() - this.startTime) / 1000;
        const throughput = elapsed > 0 ? this.completedCount / elapsed : 0;
        const avgExecutionTime = this.calculateAverageExecutionTime();
        const remainingTasks = progress.totalTasks - progress.completedTasks;
        const estimatedTimeRemaining = throughput > 0
            ? remainingTasks / throughput
            : 0;
        return {
            batchId: progress.batchId,
            status: this.mapStatus(progress.status),
            progress: {
                total: progress.totalTasks,
                completed: progress.completedTasks,
                failed: progress.failedTasks,
                percentage: progress.progressPercentage
            },
            performance: {
                throughput: Math.round(throughput * 100) / 100,
                avgExecutionTime,
                estimatedTimeRemaining: Math.round(estimatedTimeRemaining)
            },
            resources: {
                queueSize: executorStatus.queueSize,
                runningCount: executorStatus.runningCount,
                waitingCount: 0
            },
            timestamp: new Date()
        };
    }
}
//# sourceMappingURL=batch-monitor.js.map