/**
 * 执行器协调器 - 管理阶段执行器之间的协调和依赖
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowInstance, PhaseResult, PhaseNumber } from '../types';
/**
 * 执行器协调器
 */
export declare class ExecutorCoordinator {
    private workflow;
    private logger;
    private phase1Result?;
    private phase2Result?;
    private phase3Result?;
    private phase4Result?;
    constructor(workflow: WorkflowInstance);
    /**
     * 执行指定阶段
     */
    executePhase(phase: PhaseNumber): Promise<PhaseResult>;
    /**
     * 执行Phase 1
     */
    private executePhase1;
    /**
     * 执行Phase 2
     */
    private executePhase2;
    /**
     * 执行Phase 3
     */
    private executePhase3;
    /**
     * 执行Phase 4
     */
    private executePhase4;
    /**
     * 验证阶段依赖
     */
    private validatePhaseDependency;
    /**
     * 获取阶段结果
     */
    getPhaseResult(phase: PhaseNumber): any;
    /**
     * 清除所有阶段结果
     */
    clearResults(): void;
    /**
     * 执行多个阶段
     */
    executePhases(startPhase: PhaseNumber, endPhase: PhaseNumber): Promise<PhaseResult[]>;
    /**
     * 跳过阶段（使用已有结果）
     */
    skipPhase(phase: PhaseNumber, result: any): void;
}
/**
 * 执行器协调器工厂
 */
export declare class ExecutorCoordinatorFactory {
    private static instances;
    static create(workflow: WorkflowInstance): ExecutorCoordinator;
    static get(workflowId: string): ExecutorCoordinator | undefined;
    static remove(workflowId: string): boolean;
    static clear(): void;
}
//# sourceMappingURL=executor-coordinator.d.ts.map