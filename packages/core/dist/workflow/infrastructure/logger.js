/**
 * 工作流日志记录器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { LogLevel } from '../types';
/**
 * 工作流日志记录器
 */
export class WorkflowLogger {
    workflowId;
    logs = [];
    maxLogs = 10000;
    sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'authInfo', 'credential'];
    constructor(workflowId) {
        this.workflowId = workflowId;
    }
    /**
     * 记录INFO级别日志
     */
    info(phase, message, context) {
        this.log(LogLevel.INFO, phase, message, context);
    }
    /**
     * 记录DEBUG级别日志
     */
    debug(phase, message, context) {
        this.log(LogLevel.DEBUG, phase, message, context);
    }
    /**
     * 记录WARN级别日志
     */
    warn(phase, message, context) {
        this.log(LogLevel.WARN, phase, message, context);
    }
    /**
     * 记录ERROR级别日志
     */
    error(phase, message, error, context) {
        const errorContext = {
            ...context,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        };
        this.log(LogLevel.ERROR, phase, message, errorContext);
    }
    /**
     * 核心日志记录方法
     */
    log(level, phase, message, context) {
        const record = {
            workflowId: this.workflowId,
            phase,
            level,
            message,
            context: this.sanitize(context),
            timestamp: new Date().toISOString()
        };
        this.logs.push(record);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        this.outputToConsole(record);
    }
    /**
     * 输出到控制台
     */
    outputToConsole(record) {
        const prefix = `[${record.timestamp}] [${record.level}] [Workflow:${record.workflowId.substring(0, 8)}]`;
        const phaseStr = record.phase !== undefined ? `[Phase${record.phase}]` : '';
        const fullMessage = `${prefix}${phaseStr} ${record.message}`;
        switch (record.level) {
            case LogLevel.DEBUG:
                console.debug(fullMessage, record.context || '');
                break;
            case LogLevel.INFO:
                console.info(fullMessage, record.context || '');
                break;
            case LogLevel.WARN:
                console.warn(fullMessage, record.context || '');
                break;
            case LogLevel.ERROR:
                console.error(fullMessage, record.context || '');
                break;
        }
    }
    /**
     * 敏感信息脱敏
     */
    sanitize(data) {
        if (!data)
            return data;
        if (typeof data !== 'object')
            return data;
        const sanitized = Array.isArray(data) ? [...data] : { ...data };
        for (const key of Object.keys(sanitized)) {
            if (this.sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
                sanitized[key] = '***';
            }
            else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
                sanitized[key] = this.sanitize(sanitized[key]);
            }
        }
        return sanitized;
    }
    /**
     * 获取所有日志
     */
    getLogs() {
        return [...this.logs];
    }
    /**
     * 按级别过滤日志
     */
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }
    /**
     * 按阶段过滤日志
     */
    getLogsByPhase(phase) {
        return this.logs.filter(log => log.phase === phase);
    }
    /**
     * 清空日志
     */
    clear() {
        this.logs = [];
    }
    /**
     * 导出日志为JSON
     */
    exportToJson() {
        return JSON.stringify(this.logs, null, 2);
    }
}
//# sourceMappingURL=logger.js.map