/**
 * Trigger基类和接口定义
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerType, TriggerConfig, TriggerStatus as TriggerStatusEnum } from '../types';
/**
 * 测试兼容的 Trigger 构造参数
 */
export interface TestTriggerOptions {
    id: string;
    type: TriggerType;
    name: string;
    config: Record<string, any>;
}
/**
 * Trigger抽象基类
 */
export declare abstract class BaseTrigger {
    /** 内部完整配置（含 triggerId/triggerType 等元数据） */
    private fullConfig;
    /** 用户原始配置数据（测试兼容：直接暴露 config.expression 等） */
    config: Record<string, any>;
    protected isActive: boolean;
    constructor(config: TriggerConfig | TestTriggerOptions);
    /**
     * 初始化触发器（测试兼容：delegates to start()）
     */
    initialize(): Promise<void>;
    /**
     * 获取触发器状态（测试兼容）
     */
    getStatus(): TriggerStatusEnum;
    /**
     * 启动触发器
     */
    abstract start(): Promise<void>;
    /**
     * 停止触发器
     */
    abstract stop(): Promise<void>;
    /**
     * 触发回调类型
     */
    abstract setCallback(callback: TriggerCallback): void;
    /**
     * 获取触发器ID
     */
    getId(): string;
    /**
     * 获取触发器类型
     */
    getType(): TriggerType;
    /**
     * 检查是否活跃
     */
    isRunning(): boolean;
    /**
     * 获取完整配置
     */
    getConfig(): TriggerConfig;
    /**
     * 获取原始配置数据（测试兼容：直接获取 config.data 而非 TriggerConfig 包装）
     */
    get configData(): Record<string, any>;
    /**
     * 获取完整 TriggerConfig（含 triggerId 等元数据）
     */
    getFullConfig(): TriggerConfig;
}
/**
 * 触发回调函数类型
 */
export type TriggerCallback = (triggerId: string, triggerType: TriggerType, payload?: any) => Promise<void>;
/**
 * 触发器状态
 */
export interface TriggerStatus {
    triggerId: string;
    triggerType: TriggerType;
    isActive: boolean;
    lastTriggered?: Date;
    triggerCount: number;
    errorCount: number;
}
//# sourceMappingURL=base-trigger.d.ts.map