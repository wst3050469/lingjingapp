/**
 * Cron触发器 - 定时触发器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerType } from '../types';
import { WorkflowLogger } from '../infrastructure/logger';
import { BaseTrigger } from './base-trigger';
/**
 * Cron触发器
 */
export class CronTrigger extends BaseTrigger {
    logger;
    callback;
    timerId;
    cronSchedule;
    nextExecution;
    constructor(config) {
        super(config);
        this.logger = new WorkflowLogger(this.getId());
    }
    async start() {
        this.logger.info(0, 'Cron trigger starting');
        const cronConfig = this.config;
        this.cronSchedule = this.parseCronExpression(cronConfig.expression);
        this.isActive = true;
        this.scheduleNext();
        if (cronConfig.runOnStart && this.callback) {
            await this.callback(this.getId(), TriggerType.CRON, {
                scheduled: false,
                reason: 'runOnStart'
            });
        }
        this.logger.info(0, 'Cron trigger started', {
            expression: cronConfig.expression,
            nextExecution: this.nextExecution
        });
    }
    async stop() {
        this.logger.info(0, 'Cron trigger stopping');
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = undefined;
        }
        this.isActive = false;
        this.logger.info(0, 'Cron trigger stopped');
    }
    setCallback(callback) {
        this.callback = callback;
    }
    /**
     * 解析Cron表达式
     */
    parseCronExpression(expression) {
        const parts = expression.split(' ');
        if (parts.length !== 5) {
            throw new Error(`Invalid cron expression: ${expression}`);
        }
        return {
            minute: this.parseCronPart(parts[0], 0, 59),
            hour: this.parseCronPart(parts[1], 0, 23),
            dayOfMonth: this.parseCronPart(parts[2], 1, 31),
            month: this.parseCronPart(parts[3], 1, 12),
            dayOfWeek: this.parseCronPart(parts[4], 0, 6)
        };
    }
    /**
     * 解析Cron部分
     */
    parseCronPart(part, min, max) {
        if (part === '*') {
            return '*';
        }
        // Support step syntax: */5
        if (part.startsWith('*/')) {
            const step = parseInt(part.substring(2), 10);
            if (isNaN(step) || step < 1) {
                throw new Error(`Invalid cron part: ${part}`);
            }
            return min; // Return min value as representative
        }
        // Support range syntax: 1-5
        if (part.includes('-')) {
            const [startStr] = part.split('-');
            const start = parseInt(startStr, 10);
            if (isNaN(start) || start < min || start > max) {
                throw new Error(`Invalid cron part: ${part}`);
            }
            return start;
        }
        const value = parseInt(part, 10);
        if (isNaN(value) || value < min || value > max) {
            throw new Error(`Invalid cron part: ${part}`);
        }
        return value;
    }
    /**
     * 计算下次执行时间
     */
    calculateNextExecution() {
        const now = new Date();
        const next = new Date(now);
        if (!this.cronSchedule) {
            return next;
        }
        next.setSeconds(0);
        next.setMilliseconds(0);
        for (let i = 0; i < 366 * 24 * 60; i++) {
            next.setMinutes(next.getMinutes() + 1);
            if (this.matchesSchedule(next)) {
                return next;
            }
        }
        throw new Error('Could not calculate next execution time');
    }
    /**
     * 检查时间是否匹配计划
     */
    matchesSchedule(date) {
        if (!this.cronSchedule) {
            return false;
        }
        const minute = date.getMinutes();
        const hour = date.getHours();
        const dayOfMonth = date.getDate();
        const month = date.getMonth() + 1;
        const dayOfWeek = date.getDay();
        return (this.matchesCronPart(this.cronSchedule.minute, minute) &&
            this.matchesCronPart(this.cronSchedule.hour, hour) &&
            this.matchesCronPart(this.cronSchedule.dayOfMonth, dayOfMonth) &&
            this.matchesCronPart(this.cronSchedule.month, month) &&
            this.matchesCronPart(this.cronSchedule.dayOfWeek, dayOfWeek));
    }
    /**
     * 匹配Cron部分
     */
    matchesCronPart(schedule, value) {
        return schedule === '*' || schedule === value;
    }
    /**
     * 调度下次执行
     */
    scheduleNext() {
        if (!this.isActive) {
            return;
        }
        this.nextExecution = this.calculateNextExecution();
        const delay = this.nextExecution.getTime() - Date.now();
        this.timerId = setTimeout(async () => {
            await this.executeTrigger();
            this.scheduleNext();
        }, delay);
        this.logger.debug(0, 'Next execution scheduled', {
            nextExecution: this.nextExecution,
            delayMs: delay
        });
    }
    /**
     * 执行触发
     */
    async executeTrigger() {
        if (!this.callback) {
            this.logger.warn(0, 'No callback set for cron trigger');
            return;
        }
        this.logger.info(0, 'Cron trigger executing', {
            scheduledTime: this.nextExecution
        });
        try {
            await this.callback(this.getId(), TriggerType.CRON, {
                scheduled: true,
                scheduledTime: this.nextExecution,
                cronExpression: this.config.expression
            });
        }
        catch (error) {
            this.logger.error(0, 'Cron trigger execution failed', error);
        }
    }
    /**
     * 获取下次执行时间
     */
    getNextExecution() {
        return this.nextExecution;
    }
    // ===== 测试兼容方法 =====
    /**
     * 验证Cron表达式是否合法（测试兼容，静态方法）
     */
    static validateExpression(expression) {
        try {
            const parts = expression.split(' ');
            if (parts.length !== 5) {
                return false;
            }
            for (const part of parts) {
                if (part === '*')
                    continue;
                if (part.startsWith('*/')) {
                    const step = parseInt(part.substring(2), 10);
                    if (isNaN(step) || step < 1)
                        return false;
                    continue;
                }
                if (part.includes('-')) {
                    const [start, end] = part.split('-');
                    if (isNaN(parseInt(start, 10)) || isNaN(parseInt(end, 10)))
                        return false;
                    continue;
                }
                if (part.includes(',')) {
                    const values = part.split(',');
                    for (const v of values) {
                        if (isNaN(parseInt(v, 10)))
                            return false;
                    }
                    continue;
                }
                if (isNaN(parseInt(part, 10)))
                    return false;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 验证Cron表达式是否合法（实例方法，委托给静态方法）
     */
    validateExpression(expression) {
        return CronTrigger.validateExpression(expression);
    }
    /**
     * 获取下次运行时间（测试兼容，同 getNextExecution）
     * 若尚未 start，自动计算一次
     */
    getNextRunTime() {
        if (!this.nextExecution) {
            const cronConfig = this.config;
            if (cronConfig.expression) {
                try {
                    this.cronSchedule = this.parseCronExpression(cronConfig.expression);
                    this.nextExecution = this.calculateNextExecution();
                }
                catch {
                    return undefined;
                }
            }
        }
        return this.nextExecution;
    }
}
//# sourceMappingURL=cron-trigger.js.map