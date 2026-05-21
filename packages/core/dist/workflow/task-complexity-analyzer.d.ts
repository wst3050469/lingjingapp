/**
 * 任务复杂度分析器
 * 分析用户输入的任务，判断是否需要创建工作流
 */
export interface TaskComplexity {
    isComplex: boolean;
    featureName?: string;
    description?: string;
    category?: string;
    confidence: number;
}
export declare class TaskComplexityAnalyzer {
    private static COMPLEX_KEYWORDS;
    private static SIMPLE_KEYWORDS;
    /**
     * 分析任务复杂度
     */
    static analyze(userMessage: string): TaskComplexity;
    /**
     * 提取功能名称
     */
    private static extractFeatureName;
    /**
     * 提取描述
     */
    private static extractDescription;
}
//# sourceMappingURL=task-complexity-analyzer.d.ts.map