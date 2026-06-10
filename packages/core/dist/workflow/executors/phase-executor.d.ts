/**
 * 阶段执行器基类
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowInstance, PhaseNumber, PhaseResult } from '../types';
import { WorkflowLogger } from '../infrastructure/logger';
/**
 * 阶段执行器抽象基类
 */
export declare abstract class PhaseExecutor {
    protected phase: PhaseNumber;
    protected workflow: any;
    protected logger: WorkflowLogger;
    constructor(phase: PhaseNumber, workflow: any);
    /**
     * 执行阶段
     */
    execute(): Promise<PhaseResult>;
    /**
     * 执行前置条件验证
     */
    protected validatePreconditions(): Promise<void>;
    /**
     * 执行后置处理
     */
    protected postExecute(result: PhaseResult): Promise<void>;
    /**
     * 核心执行逻辑（子类必须实现）
     */
    protected abstract executeCore(): Promise<any>;
    /**
     * 带超时的执行
     */
    private executeWithTimeout;
    /**
     * 获取超时时间
     */
    protected getTimeout(): number;
    /**
     * 计算性能指标
     */
    private calculateMetrics;
    /**
     * 获取阶段编号
     */
    getPhase(): PhaseNumber;
    /**
     * 获取工作流实例
     */
    getWorkflow(): WorkflowInstance;
}
/**
 * Phase 1执行器：需求规格设计
 */
export declare class Phase1Executor extends PhaseExecutor {
    constructor(workflow: WorkflowInstance, ...args: any[]);
    protected executeCore(): Promise<any>;
}
/**
 * Phase 2执行器：实现方案创建
 */
export declare class Phase2Executor extends PhaseExecutor {
    constructor(workflow: WorkflowInstance, ...args: any[]);
    protected executeCore(): Promise<any>;
}
/**
 * Phase 3执行器：编码任务规划
 */
export declare class Phase3Executor extends PhaseExecutor {
    constructor(workflow: WorkflowInstance, ...args: any[]);
    protected executeCore(): Promise<any>;
}
/**
 * Phase 4执行器：任务执行
 */
export declare class Phase4Executor extends PhaseExecutor {
    constructor(workflow: WorkflowInstance, ...args: any[]);
    protected executeCore(): Promise<any>;
}
/**
 * 阶段执行器工厂
 */
export declare class PhaseExecutorFactory {
    static createExecutor(phase: PhaseNumber, workflow: WorkflowInstance): PhaseExecutor;
}
//# sourceMappingURL=phase-executor.d.ts.map