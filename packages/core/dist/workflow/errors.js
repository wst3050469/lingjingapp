/**
 * 工作流错误处理类层次结构
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ErrorType } from './types';
/**
 * 工作流错误基类
 */
export class WorkflowError extends Error {
    code;
    type;
    context;
    cause;
    constructor(message, code, type, context, cause) {
        super(message);
        this.code = code;
        this.type = type;
        this.context = context;
        this.cause = cause;
        this.name = 'WorkflowError';
        Object.setPrototypeOf(this, WorkflowError.prototype);
    }
    /**
     * 序列化为JSON（用于IPC传输）
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            type: this.type,
            context: this.context,
            cause: this.cause ? {
                name: this.cause.name,
                message: this.cause.message,
                stack: this.cause.stack
            } : undefined
        };
    }
    /**
     * 获取用户友好的错误消息
     */
    toUserMessage() {
        switch (this.type) {
            case ErrorType.RECOVERABLE:
                return `可恢复错误: ${this.message}。系统将自动重试。`;
            case ErrorType.NON_RECOVERABLE:
                return `操作失败: ${this.message}。请检查输入参数后重试。`;
            case ErrorType.SYSTEM:
                return `系统错误: ${this.message}。请联系技术支持。`;
            default:
                return this.message;
        }
    }
}
/**
 * 阶段执行错误
 */
export class PhaseExecutionError extends WorkflowError {
    constructor(phase, message, type = ErrorType.RECOVERABLE, context, cause) {
        super(message, `PHASE_${phase}_ERROR`, type, { phase, ...context }, cause);
        this.name = 'PhaseExecutionError';
        Object.setPrototypeOf(this, PhaseExecutionError.prototype);
    }
}
/**
 * 状态转换错误
 */
export class StateTransitionError extends WorkflowError {
    constructor(fromState, toState, message) {
        super(message || `Invalid state transition: ${fromState} -> ${toState}`, 'INVALID_STATE_TRANSITION', ErrorType.NON_RECOVERABLE, { fromState, toState });
        this.name = 'StateTransitionError';
        Object.setPrototypeOf(this, StateTransitionError.prototype);
    }
}
/**
 * Connector调用错误
 */
export class ConnectorError extends WorkflowError {
    constructor(connectorType, message, type = ErrorType.RECOVERABLE, cause) {
        super(message, `CONNECTOR_${connectorType.toUpperCase()}_ERROR`, type, { connectorType }, cause);
        this.name = 'ConnectorError';
        Object.setPrototypeOf(this, ConnectorError.prototype);
    }
}
/**
 * 配置错误
 */
export class ConfigError extends WorkflowError {
    constructor(message, configField) {
        super(message, 'CONFIG_ERROR', ErrorType.NON_RECOVERABLE, { configField });
        this.name = 'ConfigError';
        Object.setPrototypeOf(this, ConfigError.prototype);
    }
}
/**
 * 检查点错误
 */
export class CheckpointError extends WorkflowError {
    constructor(operation, message, cause) {
        super(message, `CHECKPOINT_${operation.toUpperCase()}_ERROR`, ErrorType.SYSTEM, { operation }, cause);
        this.name = 'CheckpointError';
        Object.setPrototypeOf(this, CheckpointError.prototype);
    }
}
/**
 * 触发器错误
 */
export class TriggerError extends WorkflowError {
    constructor(triggerType, message, cause) {
        super(message, `TRIGGER_${triggerType.toUpperCase()}_ERROR`, ErrorType.RECOVERABLE, { triggerType }, cause);
        this.name = 'TriggerError';
        Object.setPrototypeOf(this, TriggerError.prototype);
    }
}
/**
 * 批量任务错误
 */
export class BatchTaskError extends WorkflowError {
    constructor(batchId, taskId, message, cause) {
        super(message, 'BATCH_TASK_ERROR', ErrorType.RECOVERABLE, { batchId, taskId }, cause);
        this.name = 'BatchTaskError';
        Object.setPrototypeOf(this, BatchTaskError.prototype);
    }
}
/**
 * 验证错误
 */
export class ValidationError extends WorkflowError {
    constructor(message, field, value) {
        super(message, 'VALIDATION_ERROR', ErrorType.NON_RECOVERABLE, { field, value });
        this.name = 'ValidationError';
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
/**
 * 超时错误
 */
export class TimeoutError extends WorkflowError {
    constructor(operation, timeoutMs) {
        super(`Operation "${operation}" timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR', ErrorType.RECOVERABLE, { operation, timeoutMs });
        this.name = 'TimeoutError';
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}
/**
 * Agent通信错误
 */
export class AgentCommunicationError extends WorkflowError {
    constructor(agentId, message, cause) {
        super(message, 'AGENT_COMMUNICATION_ERROR', ErrorType.RECOVERABLE, { agentId }, cause);
        this.name = 'AgentCommunicationError';
        Object.setPrototypeOf(this, AgentCommunicationError.prototype);
    }
}
/**
 * 任务执行错误
 */
export class TaskExecutionError extends WorkflowError {
    constructor(taskId, message, cause) {
        super(message, 'TASK_EXECUTION_ERROR', ErrorType.RECOVERABLE, { taskId }, cause);
        this.name = 'TaskExecutionError';
        Object.setPrototypeOf(this, TaskExecutionError.prototype);
    }
}
/**
 * 配置错误（别名）
 */
export const ConfigurationError = ConfigError;
/**
 * 从JSON反序列化错误对象
 */
export function deserializeError(json) {
    const error = new WorkflowError(json.message, json.code, json.type, json.context, json.cause ? new Error(json.cause.message) : undefined);
    error.name = json.name;
    return error;
}
//# sourceMappingURL=errors.js.map