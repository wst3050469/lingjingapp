/**
 * 工作流错误处理类层次结构
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ErrorType, WorkflowState, PhaseNumber } from './types';
/**
 * 工作流错误基类
 */
export declare class WorkflowError extends Error {
    readonly code: string;
    readonly type: ErrorType;
    readonly context?: any | undefined;
    readonly cause?: Error | undefined;
    constructor(message: string, code: string, type: ErrorType, context?: any | undefined, cause?: Error | undefined);
    /**
     * 序列化为JSON（用于IPC传输）
     */
    toJSON(): object;
    /**
     * 获取用户友好的错误消息
     */
    toUserMessage(): string;
}
/**
 * 阶段执行错误
 */
export declare class PhaseExecutionError extends WorkflowError {
    constructor(phase: PhaseNumber, message: string, type?: ErrorType, context?: any, cause?: Error);
}
/**
 * 状态转换错误
 */
export declare class StateTransitionError extends WorkflowError {
    constructor(fromState: WorkflowState, toState: WorkflowState, message?: string);
}
/**
 * Connector调用错误
 */
export declare class ConnectorError extends WorkflowError {
    constructor(connectorType: string, message: string, type?: ErrorType, cause?: Error);
}
/**
 * 配置错误
 */
export declare class ConfigError extends WorkflowError {
    constructor(message: string, configField?: string);
}
/**
 * 检查点错误
 */
export declare class CheckpointError extends WorkflowError {
    constructor(operation: 'create' | 'restore' | 'delete', message: string, cause?: Error);
}
/**
 * 触发器错误
 */
export declare class TriggerError extends WorkflowError {
    constructor(triggerType: string, message: string, cause?: Error);
}
/**
 * 批量任务错误
 */
export declare class BatchTaskError extends WorkflowError {
    constructor(batchId: string, taskId: string, message: string, cause?: Error);
}
/**
 * 验证错误
 */
export declare class ValidationError extends WorkflowError {
    constructor(message: string, field?: string, value?: any);
}
/**
 * 超时错误
 */
export declare class TimeoutError extends WorkflowError {
    constructor(operation: string, timeoutMs: number);
}
/**
 * Agent通信错误
 */
export declare class AgentCommunicationError extends WorkflowError {
    constructor(agentId: string, message: string, cause?: Error);
}
/**
 * 任务执行错误
 */
export declare class TaskExecutionError extends WorkflowError {
    constructor(taskId: string, message: string, cause?: Error);
}
/**
 * 配置错误（别名）
 */
export declare const ConfigurationError: typeof ConfigError;
/**
 * 从JSON反序列化错误对象
 */
export declare function deserializeError(json: any): WorkflowError;
//# sourceMappingURL=errors.d.ts.map