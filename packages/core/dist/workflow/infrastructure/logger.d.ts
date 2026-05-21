/**
 * 工作流日志记录器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { PhaseNumber, LogLevel } from '../types';
/**
 * 日志记录接口
 */
interface LogRecord {
    workflowId: string;
    phase?: PhaseNumber;
    level: LogLevel;
    message: string;
    context?: any;
    timestamp: string;
}
/**
 * 工作流日志记录器
 */
export declare class WorkflowLogger {
    private workflowId;
    private logs;
    private maxLogs;
    private sensitiveKeys;
    constructor(workflowId: string);
    /**
     * 记录INFO级别日志
     */
    info(phase: PhaseNumber | undefined, message: string, context?: any): void;
    /**
     * 记录DEBUG级别日志
     */
    debug(phase: PhaseNumber | undefined, message: string, context?: any): void;
    /**
     * 记录WARN级别日志
     */
    warn(phase: PhaseNumber | undefined, message: string, context?: any): void;
    /**
     * 记录ERROR级别日志
     */
    error(phase: PhaseNumber | undefined, message: string, error?: Error, context?: any): void;
    /**
     * 核心日志记录方法
     */
    private log;
    /**
     * 输出到控制台
     */
    private outputToConsole;
    /**
     * 敏感信息脱敏
     */
    private sanitize;
    /**
     * 获取所有日志
     */
    getLogs(): LogRecord[];
    /**
     * 按级别过滤日志
     */
    getLogsByLevel(level: LogLevel): LogRecord[];
    /**
     * 按阶段过滤日志
     */
    getLogsByPhase(phase: PhaseNumber): LogRecord[];
    /**
     * 清空日志
     */
    clear(): void;
    /**
     * 导出日志为JSON
     */
    exportToJson(): string;
}
export {};
//# sourceMappingURL=logger.d.ts.map