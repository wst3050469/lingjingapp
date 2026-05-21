/**
 * 工作流状态机
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowState } from '../types';
/**
 * StateType 枚举（测试兼容，与 workflow/types.ts 保持一致）
 */
export declare enum StateType {
    IDLE = "IDLE",
    PHASE1_START = "PHASE1_START",
    PHASE1_EXEC = "PHASE1_EXEC",
    PHASE1_RUNNING = "PHASE1_RUNNING",
    PHASE1_DONE = "PHASE1_DONE",
    PHASE2_START = "PHASE2_START",
    PHASE2_EXEC = "PHASE2_EXEC",
    PHASE2_RUNNING = "PHASE2_RUNNING",
    PHASE2_DONE = "PHASE2_DONE",
    PHASE3_START = "PHASE3_START",
    PHASE3_EXEC = "PHASE3_EXEC",
    PHASE3_RUNNING = "PHASE3_RUNNING",
    PHASE3_DONE = "PHASE3_DONE",
    PHASE4_START = "PHASE4_START",
    PHASE4_EXEC = "PHASE4_EXEC",
    PHASE4_RUNNING = "PHASE4_RUNNING",
    PHASE4_DONE = "PHASE4_DONE",
    COMPLETED = "COMPLETED",
    PAUSED = "PAUSED",
    FAILED = "FAILED",
    ROLLBACK = "ROLLBACK"
}
/**
 * 状态变更监听器类型
 */
export type StateChangeListener = (from: WorkflowState, to: WorkflowState) => void | Promise<void>;
/**
 * 工作流状态机
 */
export declare class WorkflowStateMachine {
    private stateChangeListeners;
    private currentState;
    private currentStateType;
    private previousStateType?;
    /**
     * 验证状态转换是否合法
     */
    canTransition(from: WorkflowState, to: WorkflowState): boolean;
    /**
     * 获取合法的转换目标状态
     */
    getAllowedTransitions(from: WorkflowState): WorkflowState[];
    /**
     * 注册状态变更监听器
     */
    onStateChange(listener: StateChangeListener): void;
    /**
     * 移除状态变更监听器
     */
    offStateChange(listener: StateChangeListener): void;
    /**
     * 通知状态变更监听器
     */
    private notifyStateChange;
    /**
     * 判断是否为终态
     */
    isTerminal(state: WorkflowState): boolean;
    /**
     * 判断是否为执行中状态（含已启动但未进入执行态的情况）
     */
    isExecuting(state: WorkflowState): boolean;
    /**
     * 判断是否为暂停状态
     */
    isPaused(state: WorkflowState): boolean;
    /**
     * 判断是否为启动状态
     */
    isStart(state: WorkflowState): boolean;
    /**
     * 判断是否为完成状态
     */
    isDone(state: WorkflowState): boolean;
    /**
     * 从状态提取阶段编号
     */
    extractPhase(state: WorkflowState): number | null;
    /**
     * 获取指定阶段的开始状态
     */
    getPhaseStartState(phase: number): WorkflowState;
    /**
     * 获取指定阶段的执行状态
     */
    getPhaseExecutingState(phase: number): WorkflowState;
    /**
     * 获取指定阶段的暂停状态
     */
    getPhasePausedState(phase: number): WorkflowState;
    /**
     * 获取指定阶段的完成状态
     */
    getPhaseDoneState(phase: number): WorkflowState;
    /**
     * 获取当前 StateType（测试兼容）
     */
    getCurrentState(): StateType;
    /**
     * 获取上一个 StateType（测试兼容）
     */
    getPreviousState(): StateType | undefined;
    /**
     * 检查能否转换到目标 StateType（测试兼容）
     */
    canTransitionTo(to: StateType): boolean;
    /**
     * 执行状态转换（测试兼容，简化版单参数 StateType 版本）
     */
    transitionTo(to: StateType): void;
    /**
     * 统一状态转换入口
     * 支持两种调用方式：
     * 1. transition(workflowId, from, to, updateState, logTransition) — 内部使用
     * 2. transition(to: StateType) — 测试兼容
     */
    transition(arg1: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any): void | Promise<void>;
    /**
     * 执行工作流状态转换（原5参数版）
     */
    private transitionWorkflowState;
    /**
     * 将 WorkflowState 映射为 StateType（用于 getStatus 同步）
     */
    private workflowStateToStateType;
    /**
     * 获取当前阶段编号（测试兼容）
     */
    getPhaseNumber(): number;
    /**
     * 检查是否正在运行（测试兼容）
     */
    isRunning(): boolean;
    /**
     * 检查是否已完成（测试兼容）
     */
    isCompleted(): boolean;
    /**
     * 检查是否已失败（测试兼容）
     */
    isFailed(): boolean;
    /**
     * 检查是否已暂停（测试兼容）
     */
    isPausedState(): boolean;
    /**
     * 检查是否空闲（测试兼容）
     */
    isIdle(): boolean;
    /**
     * 获取下一个自动转换状态（测试兼容）
     */
    getNextAutoState(): StateType | null;
    /**
     * 获取阶段名称（测试兼容）
     */
    getPhaseName(): string;
    /**
     * 是否可以暂停（测试兼容）
     */
    canPause(): boolean;
    /**
     * 是否可以恢复（测试兼容）
     */
    canResume(): boolean;
    /**
     * 是否可以停止（测试兼容）
     */
    canStop(): boolean;
    /**
     * 查找状态节点（测试兼容）
     */
    findNode(nodeId: string): StateType | undefined;
    /**
     * 查找转换路径（测试兼容）
     */
    findTransition(from: StateType, to: StateType): boolean;
    /**
     * 重置状态（测试兼容）
     */
    resetState(): void;
    /**
     * 执行转换并返回结果（测试兼容）
     */
    executeTransition(from: StateType, to: StateType): boolean;
}
/**
 * 全局状态机实例
 */
export declare const workflowStateMachine: WorkflowStateMachine;
//# sourceMappingURL=state-machine.d.ts.map