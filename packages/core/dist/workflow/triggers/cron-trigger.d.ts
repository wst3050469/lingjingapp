/**
 * Cron触发器 - 定时触发器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerConfig } from '../types';
import { BaseTrigger, TriggerCallback } from './base-trigger';
/**
 * Cron配置
 */
export interface CronConfig {
    expression: string;
    timezone?: string;
    runOnStart?: boolean;
}
/**
 * Cron解析结果
 */
export interface CronSchedule {
    minute: number | '*';
    hour: number | '*';
    dayOfMonth: number | '*';
    month: number | '*';
    dayOfWeek: number | '*';
}
/**
 * Cron触发器
 */
export declare class CronTrigger extends BaseTrigger {
    private logger;
    private callback?;
    private timerId?;
    private cronSchedule?;
    private nextExecution?;
    constructor(config: TriggerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    setCallback(callback: TriggerCallback): void;
    /**
     * 解析Cron表达式
     */
    private parseCronExpression;
    /**
     * 解析Cron部分
     */
    private parseCronPart;
    /**
     * 计算下次执行时间
     */
    private calculateNextExecution;
    /**
     * 检查时间是否匹配计划
     */
    private matchesSchedule;
    /**
     * 匹配Cron部分
     */
    private matchesCronPart;
    /**
     * 调度下次执行
     */
    private scheduleNext;
    /**
     * 执行触发
     */
    private executeTrigger;
    /**
     * 获取下次执行时间
     */
    getNextExecution(): Date | undefined;
    /**
     * 验证Cron表达式是否合法（测试兼容，静态方法）
     */
    static validateExpression(expression: string): boolean;
    /**
     * 验证Cron表达式是否合法（实例方法，委托给静态方法）
     */
    validateExpression(expression: string): boolean;
    /**
     * 获取下次运行时间（测试兼容，同 getNextExecution）
     * 若尚未 start，自动计算一次
     */
    getNextRunTime(): Date | undefined;
}
//# sourceMappingURL=cron-trigger.d.ts.map