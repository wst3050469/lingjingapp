/**
 * 结果聚合器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
/**
 * 任务结果
 */
export interface TaskResult {
    taskId: string;
    taskName: string;
    success: boolean;
    output?: any;
    error?: Error;
    duration: number;
    metadata?: Record<string, any>;
}
/**
 * 聚合结果
 */
export interface AggregatedResult {
    batchId: string;
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    successRate: number;
    totalDuration: number;
    averageDuration: number;
    results: TaskResult[];
    summary: ResultSummary;
    createdAt: Date;
}
/**
 * 结果摘要
 */
export interface ResultSummary {
    minDuration: number;
    maxDuration: number;
    medianDuration: number;
    errorTypes: Record<string, number>;
    outputSummary?: any;
}
/**
 * 结果聚合器
 */
export declare class ResultAggregator {
    private logger;
    private results;
    private batchId;
    constructor(batchId: string);
    /**
     * 添加结果
     */
    addResult(result: TaskResult): void;
    /**
     * 批量添加结果
     */
    addResults(results: TaskResult[]): void;
    /**
     * 聚合结果
     */
    aggregate(): AggregatedResult;
    /**
     * 计算摘要
     */
    private calculateSummary;
    /**
     * 获取成功结果
     */
    getSuccessfulResults(): TaskResult[];
    /**
     * 获取失败结果
     */
    getFailedResults(): TaskResult[];
    /**
     * 按条件过滤结果
     */
    filterResults(predicate: (result: TaskResult) => boolean): TaskResult[];
    /**
     * 按任务名分组
     */
    groupByTaskName(): Map<string, TaskResult[]>;
    /**
     * 计算统计数据
     */
    calculateStatistics(): {
        total: number;
        success: number;
        failure: number;
        successRate: number;
        avgDuration: number;
        totalDuration: number;
    };
    /**
     * 清空结果
     */
    clear(): void;
    /**
     * 获取结果数量
     */
    getCount(): number;
}
//# sourceMappingURL=result-aggregator.d.ts.map