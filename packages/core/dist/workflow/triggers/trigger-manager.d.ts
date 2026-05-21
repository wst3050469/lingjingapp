/**
 * Trigger管理器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerType, TriggerConfig, TriggerStatus as TriggerStatusEnum } from '../types';
import { BaseTrigger, TriggerCallback, TriggerStatus } from './base-trigger';
/**
 * Trigger管理器
 */
export declare class TriggerManager {
    private triggers;
    private callbacks;
    private logger;
    private static instance?;
    /**
     * Trigger管理器（支持测试直接 new）
     */
    constructor();
    /**
     * 获取单例实例
     */
    static getInstance(): TriggerManager;
    /**
     * 注册触发器
     */
    registerTrigger(trigger: BaseTrigger, callback: TriggerCallback): Promise<void>;
    /**
     * 注销触发器
     */
    unregisterTrigger(triggerId: string): Promise<void>;
    /**
     * 触发事件
     */
    trigger(triggerId: string, payload?: any): Promise<void>;
    /**
     * 获取触发器状态
     */
    getTriggerStatus(triggerId: string): TriggerStatus | undefined;
    /**
     * 获取所有触发器状态
     */
    getAllTriggerStatus(): TriggerStatus[];
    /**
     * 按类型获取触发器
     */
    getTriggersByType(type: TriggerType): BaseTrigger[];
    /**
     * 启动所有触发器
     */
    startAll(): Promise<void>;
    /**
     * 停止所有触发器
     */
    stopAll(): Promise<void>;
    /**
     * 清理所有触发器
     */
    clear(): Promise<void>;
    /**
     * 获取触发器数量
     */
    getTriggerCount(): number;
    /**
     * 创建触发器（测试兼容）
     */
    create(trigger: BaseTrigger): Promise<void>;
    /**
     * 更新触发器（测试兼容）
     */
    update(triggerId: string, updates: Partial<TriggerConfig>): Promise<void>;
    /**
     * 删除触发器（测试兼容）
     */
    delete(triggerId: string): Promise<void>;
    /**
     * 获取触发器（测试兼容）
     */
    get(triggerId: string): Promise<BaseTrigger | undefined>;
    /**
     * 获取触发器状态（测试兼容）
     */
    getStatus(triggerId: string): Promise<{
        status: TriggerStatusEnum;
    } | undefined>;
    /**
     * 启用触发器（测试兼容）
     */
    enable(triggerId: string): Promise<void>;
    /**
     * 禁用触发器（测试兼容）
     */
    disable(triggerId: string): Promise<void>;
    /**
     * 列出所有触发器（测试兼容）
     */
    list(): Promise<BaseTrigger[]>;
    /**
     * 清理所有触发器（测试兼容）
     */
    cleanup(): Promise<void>;
}
export declare const triggerManager: TriggerManager;
//# sourceMappingURL=trigger-manager.d.ts.map