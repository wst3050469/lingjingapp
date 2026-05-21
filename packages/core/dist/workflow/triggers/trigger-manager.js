/**
 * Trigger管理器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerStatus as TriggerStatusEnum } from '../types';
import { WorkflowLogger } from '../infrastructure/logger';
/**
 * Trigger管理器
 */
export class TriggerManager {
    triggers = new Map();
    callbacks = new Map();
    logger;
    static instance;
    /**
     * Trigger管理器（支持测试直接 new）
     */
    constructor() {
        this.logger = new WorkflowLogger('trigger-manager');
    }
    /**
     * 获取单例实例
     */
    static getInstance() {
        if (!TriggerManager.instance) {
            TriggerManager.instance = new TriggerManager();
        }
        return TriggerManager.instance;
    }
    /**
     * 注册触发器
     */
    async registerTrigger(trigger, callback) {
        const triggerId = trigger.getId();
        if (this.triggers.has(triggerId)) {
            this.logger.warn(0, `Trigger ${triggerId} already registered, replacing`);
            await this.unregisterTrigger(triggerId);
        }
        trigger.setCallback(callback);
        await trigger.start();
        this.triggers.set(triggerId, {
            trigger,
            registeredAt: new Date(),
            triggerCount: 0,
            errorCount: 0
        });
        this.callbacks.set(triggerId, callback);
        this.logger.info(0, `Trigger ${triggerId} registered`, {
            type: trigger.getType()
        });
    }
    /**
     * 注销触发器
     */
    async unregisterTrigger(triggerId) {
        const registration = this.triggers.get(triggerId);
        if (!registration) {
            this.logger.warn(0, `Trigger ${triggerId} not found`);
            return;
        }
        await registration.trigger.stop();
        this.triggers.delete(triggerId);
        this.callbacks.delete(triggerId);
        this.logger.info(0, `Trigger ${triggerId} unregistered`);
    }
    /**
     * 触发事件
     */
    async trigger(triggerId, payload) {
        const registration = this.triggers.get(triggerId);
        const callback = this.callbacks.get(triggerId);
        if (!registration || !callback) {
            this.logger.warn(0, `Trigger ${triggerId} not found`);
            return;
        }
        const trigger = registration.trigger;
        try {
            await callback(triggerId, trigger.getType(), payload);
            registration.lastTriggered = new Date();
            registration.triggerCount++;
            this.logger.info(0, `Trigger ${triggerId} fired`, {
                type: trigger.getType(),
                triggerCount: registration.triggerCount
            });
        }
        catch (error) {
            registration.errorCount++;
            this.logger.error(0, `Trigger ${triggerId} callback failed`, error);
        }
    }
    /**
     * 获取触发器状态
     */
    getTriggerStatus(triggerId) {
        const registration = this.triggers.get(triggerId);
        if (!registration) {
            return undefined;
        }
        return {
            triggerId,
            triggerType: registration.trigger.getType(),
            isActive: registration.trigger.isRunning(),
            lastTriggered: registration.lastTriggered,
            triggerCount: registration.triggerCount,
            errorCount: registration.errorCount
        };
    }
    /**
     * 获取所有触发器状态
     */
    getAllTriggerStatus() {
        const statuses = [];
        for (const [id, registration] of this.triggers) {
            statuses.push({
                triggerId: id,
                triggerType: registration.trigger.getType(),
                isActive: registration.trigger.isRunning(),
                lastTriggered: registration.lastTriggered,
                triggerCount: registration.triggerCount,
                errorCount: registration.errorCount
            });
        }
        return statuses;
    }
    /**
     * 按类型获取触发器
     */
    getTriggersByType(type) {
        const triggers = [];
        for (const registration of this.triggers.values()) {
            if (registration.trigger.getType() === type) {
                triggers.push(registration.trigger);
            }
        }
        return triggers;
    }
    /**
     * 启动所有触发器
     */
    async startAll() {
        for (const [id, registration] of this.triggers) {
            if (!registration.trigger.isRunning()) {
                await registration.trigger.start();
                this.logger.info(0, `Trigger ${id} started`);
            }
        }
    }
    /**
     * 停止所有触发器
     */
    async stopAll() {
        for (const [id, registration] of this.triggers) {
            if (registration.trigger.isRunning()) {
                await registration.trigger.stop();
                this.logger.info(0, `Trigger ${id} stopped`);
            }
        }
    }
    /**
     * 清理所有触发器
     */
    async clear() {
        for (const id of this.triggers.keys()) {
            await this.unregisterTrigger(id);
        }
    }
    /**
     * 获取触发器数量
     */
    getTriggerCount() {
        return this.triggers.size;
    }
    // ===== 测试兼容方法 =====
    /**
     * 创建触发器（测试兼容）
     */
    async create(trigger) {
        // Triggers without explicit callback use a no-op
        await this.registerTrigger(trigger, async () => { });
    }
    /**
     * 更新触发器（测试兼容）
     */
    async update(triggerId, updates) {
        const registration = this.triggers.get(triggerId);
        if (registration) {
            const currentConfig = registration.trigger.getConfig();
            if (updates.config) {
                Object.assign(currentConfig.config, updates.config);
            }
            Object.assign(currentConfig, updates);
        }
    }
    /**
     * 删除触发器（测试兼容）
     */
    async delete(triggerId) {
        await this.unregisterTrigger(triggerId);
    }
    /**
     * 获取触发器（测试兼容）
     */
    async get(triggerId) {
        return this.triggers.get(triggerId)?.trigger;
    }
    /**
     * 获取触发器状态（测试兼容）
     */
    async getStatus(triggerId) {
        const status = this.getTriggerStatus(triggerId);
        if (!status)
            return undefined;
        return {
            status: status.isActive ? TriggerStatusEnum.ENABLED : TriggerStatusEnum.DISABLED
        };
    }
    /**
     * 启用触发器（测试兼容）
     */
    async enable(triggerId) {
        const registration = this.triggers.get(triggerId);
        if (registration) {
            await registration.trigger.start();
        }
    }
    /**
     * 禁用触发器（测试兼容）
     */
    async disable(triggerId) {
        const registration = this.triggers.get(triggerId);
        if (registration) {
            await registration.trigger.stop();
        }
    }
    /**
     * 列出所有触发器（测试兼容）
     */
    async list() {
        const triggers = [];
        for (const reg of this.triggers.values()) {
            triggers.push(reg.trigger);
        }
        return triggers;
    }
    /**
     * 清理所有触发器（测试兼容）
     */
    async cleanup() {
        await this.clear();
    }
}
export const triggerManager = TriggerManager.getInstance();
//# sourceMappingURL=trigger-manager.js.map