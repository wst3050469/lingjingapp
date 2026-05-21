/**
 * Phase 4执行器：验证阶段
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowInstance } from '../types';
import { PhaseExecutor } from './phase-executor';
import { ImplementationPlan } from './phase3-executor';
/**
 * 验证结果
 */
export interface ValidationResult {
    validationId: string;
    taskResults: TaskExecutionResult[];
    summary: ValidationSummary;
    artifacts: GeneratedArtifact[];
    createdAt: Date;
}
/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
    taskId: string;
    taskName: string;
    success: boolean;
    output?: any;
    error?: string;
    durationMs: number;
    retryCount: number;
}
/**
 * 验证摘要
 */
export interface ValidationSummary {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    skippedTasks: number;
    totalDurationMs: number;
    successRate: number;
}
/**
 * 生成的产物
 */
export interface GeneratedArtifact {
    artifactId: string;
    type: 'FILE' | 'TEST' | 'DOCUMENT' | 'CONFIG';
    path: string;
    size?: number;
    description: string;
}
/**
 * Phase 4执行器：验证阶段
 */
export declare class Phase4ExecutorEnhanced extends PhaseExecutor {
    private implementationPlan?;
    private taskResults;
    constructor(workflow: WorkflowInstance, implementationPlan?: ImplementationPlan);
    protected validatePreconditions(): Promise<void>;
    protected executeCore(): Promise<ValidationResult>;
    private generateValidationId;
    private executeTasks;
    private executeTask;
    private simulateTaskExecution;
    private shouldContinueOnFailure;
    private calculateSummary;
    private collectArtifacts;
    private delay;
}
export { Phase4Executor } from './phase-executor';
//# sourceMappingURL=phase4-executor.d.ts.map