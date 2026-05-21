/**
 * Trigger基类和接口定义
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerStatus as TriggerStatusEnum } from '../types';
/**
 * Trigger抽象基类
 */
export class BaseTrigger {
    /** 内部完整配置（含 triggerId/triggerType 等元数据） */
    fullConfig;
    /** 用户原始配置数据（测试兼容：直接暴露 config.expression 等） */
    config;
    isActive = false;
    constructor(config) {
        // Support both production and test constructor formats
        if ('triggerId' in config) {
            this.fullConfig = config;
        }
        else {
            const opts = config;
            this.fullConfig = {
                triggerId: opts.id,
                triggerType: opts.type,
                config: opts.config,
                isEnabled: true
            };
        }
        this.config = this.fullConfig.config;
    }
    /**
     * 初始化触发器（测试兼容：delegates to start()）
     */
    async initialize() {
        await this.start();
    }
    /**
     * 获取触发器状态（测试兼容）
     */
    getStatus() {
        return this.isActive ? TriggerStatusEnum.ENABLED : TriggerStatusEnum.DISABLED;
    }
    /**
     * 获取触发器ID
     */
    getId() {
        return this.fullConfig.triggerId;
    }
    /**
     * 获取触发器类型
     */
    getType() {
        return this.fullConfig.triggerType;
    }
    /**
     * 检查是否活跃
     */
    isRunning() {
        return this.isActive;
    }
    /**
     * 获取完整配置
     */
    getConfig() {
        return this.fullConfig;
    }
    /**
     * 获取原始配置数据（测试兼容：直接获取 config.data 而非 TriggerConfig 包装）
     */
    get configData() {
        return this.fullConfig.config;
    }
    /**
     * 获取完整 TriggerConfig（含 triggerId 等元数据）
     */
    getFullConfig() {
        return this.fullConfig;
    }
}
//# sourceMappingURL=base-trigger.js.map