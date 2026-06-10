/**
 * Phase 3执行器：实现阶段
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowInstance } from '../types';
import { PhaseExecutor } from './phase-executor';
import { DesignDocument } from './phase2-executor';
/**
 * 实现计划
 */
export interface ImplementationPlan {
    planId: string;
    tasks: ImplementationTask[];
    executionOrder: string[];
    parallelizableGroups: string[][];
    estimatedEffort: EffortEstimate;
    createdAt: Date;
}
/**
 * 实现任务
 */
export interface ImplementationTask {
    taskId: string;
    taskName: string;
    taskType: 'CREATE_FILE' | 'MODIFY_FILE' | 'CREATE_TEST' | 'CONFIGURATION';
    description: string;
    filePath?: string;
    dependencies: string[];
    priority: number;
    estimatedTime: number;
    codeTemplate?: string;
}
/**
 * 工作量估算
 */
export interface EffortEstimate {
    totalTasks: number;
    estimatedHours: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}
/**
 * Phase 3执行器：实现阶段
 */
export declare class Phase3ExecutorEnhanced extends PhaseExecutor {
    private designResult?;
    private tasks;
    constructor(workflow: WorkflowInstance, designResult?: DesignDocument);
    protected validatePreconditions(): Promise<void>;
    protected executeCore(): Promise<ImplementationPlan>;
    private generatePlanId;
    private generateImplementationTasks;
    private calculateExecutionOrder;
    private identifyParallelizableGroups;
    private estimateEffort;
}
export { Phase3Executor } from './phase-executor';
//# sourceMappingURL=phase3-executor.d.ts.map