/**
 * 结果聚合器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
/**
 * 结果聚合器
 */
export class ResultAggregator {
    logger;
    results = [];
    batchId;
    constructor(batchId) {
        this.batchId = batchId;
        this.logger = new WorkflowLogger(`result-aggregator-${batchId}`);
    }
    /**
     * 添加结果
     */
    addResult(result) {
        this.results.push(result);
        this.logger.debug(0, `Result added: ${result.taskId}`, {
            success: result.success,
            duration: result.duration
        });
    }
    /**
     * 批量添加结果
     */
    addResults(results) {
        for (const result of results) {
            this.addResult(result);
        }
    }
    /**
     * 聚合结果
     */
    aggregate() {
        const totalTasks = this.results.length;
        const successfulTasks = this.results.filter(r => r.success).length;
        const failedTasks = totalTasks - successfulTasks;
        const successRate = totalTasks > 0
            ? Math.round((successfulTasks / totalTasks) * 100)
            : 0;
        const durations = this.results.map(r => r.duration);
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        const averageDuration = totalTasks > 0
            ? Math.round(totalDuration / totalTasks)
            : 0;
        const summary = this.calculateSummary(durations);
        const result = {
            batchId: this.batchId,
            totalTasks,
            successfulTasks,
            failedTasks,
            successRate,
            totalDuration,
            averageDuration,
            results: this.results,
            summary,
            createdAt: new Date()
        };
        this.logger.info(0, 'Results aggregated', {
            totalTasks,
            successfulTasks,
            failedTasks,
            successRate
        });
        return result;
    }
    /**
     * 计算摘要
     */
    calculateSummary(durations) {
        if (durations.length === 0) {
            return {
                minDuration: 0,
                maxDuration: 0,
                medianDuration: 0,
                errorTypes: {}
            };
        }
        const sorted = [...durations].sort((a, b) => a - b);
        const minDuration = sorted[0];
        const maxDuration = sorted[sorted.length - 1];
        const mid = Math.floor(sorted.length / 2);
        const medianDuration = sorted.length % 2 !== 0
            ? sorted[mid]
            : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
        const errorTypes = {};
        for (const result of this.results) {
            if (!result.success && result.error) {
                const errorName = result.error.name || 'UnknownError';
                errorTypes[errorName] = (errorTypes[errorName] || 0) + 1;
            }
        }
        return {
            minDuration,
            maxDuration,
            medianDuration,
            errorTypes
        };
    }
    /**
     * 获取成功结果
     */
    getSuccessfulResults() {
        return this.results.filter(r => r.success);
    }
    /**
     * 获取失败结果
     */
    getFailedResults() {
        return this.results.filter(r => !r.success);
    }
    /**
     * 按条件过滤结果
     */
    filterResults(predicate) {
        return this.results.filter(predicate);
    }
    /**
     * 按任务名分组
     */
    groupByTaskName() {
        const groups = new Map();
        for (const result of this.results) {
            const group = groups.get(result.taskName) || [];
            group.push(result);
            groups.set(result.taskName, group);
        }
        return groups;
    }
    /**
     * 计算统计数据
     */
    calculateStatistics() {
        const total = this.results.length;
        const success = this.results.filter(r => r.success).length;
        const failure = total - success;
        const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
        const durations = this.results.map(r => r.duration);
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
        return {
            total,
            success,
            failure,
            successRate,
            avgDuration,
            totalDuration
        };
    }
    /**
     * 清空结果
     */
    clear() {
        this.results = [];
        this.logger.info(0, 'Results cleared');
    }
    /**
     * 获取结果数量
     */
    getCount() {
        return this.results.length;
    }
}
//# sourceMappingURL=result-aggregator.js.map