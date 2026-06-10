/**
 * Event触发器 - 事件触发器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerType } from '../types';
import { WorkflowLogger } from '../infrastructure/logger';
import { BaseTrigger } from './base-trigger';
/**
 * 事件类型
 */
export var EventType;
(function (EventType) {
    EventType["GIT_PUSH"] = "git_push";
    EventType["GIT_MERGE"] = "git_merge";
    EventType["GIT_PULL_REQUEST"] = "git_pull_request";
    EventType["USER_ACTION"] = "user_action";
    EventType["SYSTEM_STARTUP"] = "system_startup";
    EventType["SYSTEM_SHUTDOWN"] = "system_shutdown";
    EventType["WORKFLOW_CREATED"] = "workflow_created";
    EventType["WORKFLOW_COMPLETED"] = "workflow_completed";
    EventType["FILE_CHANGED"] = "file_changed";
    EventType["CUSTOM"] = "custom";
})(EventType || (EventType = {}));
/**
 * Event触发器
 */
export class EventTrigger extends BaseTrigger {
    logger;
    callback;
    eventQueue = [];
    isProcessing = false;
    eventListeners = new Map();
    constructor(config) {
        super(config);
        this.logger = new WorkflowLogger(this.getId());
        // Support callback in config (test compat)
        const eventConfig = this.config;
        if (eventConfig.callback && typeof eventConfig.callback === 'function') {
            this.callback = eventConfig.callback;
        }
    }
    async start() {
        this.logger.info(0, 'Event trigger starting');
        const eventConfig = this.config;
        if (eventConfig.eventTypes) {
            for (const eventType of eventConfig.eventTypes) {
                this.registerEventListener(eventType);
            }
        }
        this.isActive = true;
        this.logger.info(0, 'Event trigger started', {
            eventTypes: eventConfig.eventTypes || []
        });
    }
    async stop() {
        this.logger.info(0, 'Event trigger stopping');
        for (const [key, listener] of this.eventListeners) {
            this.unregisterEventListener(key, listener);
        }
        this.eventListeners.clear();
        this.isActive = false;
        this.logger.info(0, 'Event trigger stopped');
    }
    setCallback(callback) {
        this.callback = callback;
    }
    /**
     * 注册事件监听器
     */
    registerEventListener(eventType) {
        const listener = async (event) => {
            await this.handleEvent(event);
        };
        this.eventListeners.set(eventType, listener);
        this.logger.debug(0, `Event listener registered: ${eventType}`);
    }
    /**
     * 注销事件监听器
     */
    unregisterEventListener(key, listener) {
        this.logger.debug(0, `Event listener unregistered: ${key}`);
    }
    /**
     * 处理事件
     */
    async handleEvent(event) {
        this.logger.info(0, 'Event received', {
            eventType: event.eventType,
            source: event.source
        });
        const eventConfig = this.config;
        if (!this.matchesFilter(event, eventConfig.filter)) {
            this.logger.debug(0, 'Event filtered out');
            return;
        }
        this.eventQueue.push(event);
        if (!this.isProcessing) {
            await this.processEventQueue();
        }
    }
    /**
     * 匹配过滤器
     */
    matchesFilter(event, filter) {
        if (!filter) {
            return true;
        }
        if (filter.source && event.source !== filter.source) {
            return false;
        }
        if (filter.pattern) {
            const regex = new RegExp(filter.pattern);
            if (!regex.test(JSON.stringify(event.payload))) {
                return false;
            }
        }
        if (filter.conditions) {
            for (const [key, value] of Object.entries(filter.conditions)) {
                if (event.payload[key] !== value) {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * 处理事件队列
     */
    async processEventQueue() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            if (!event || !this.callback) {
                continue;
            }
            try {
                await this.callback(this.getId(), TriggerType.EVENT, {
                    eventType: event.eventType,
                    source: event.source,
                    timestamp: event.timestamp,
                    payload: event.payload
                });
                this.logger.info(0, 'Event processed', {
                    eventType: event.eventType
                });
            }
            catch (error) {
                this.logger.error(0, 'Event processing failed', error);
            }
        }
        this.isProcessing = false;
    }
    /**
     * 手动触发事件
     */
    async emitEvent(event) {
        const listener = this.eventListeners.get(event.eventType);
        if (!listener) {
            // If no listener registered but we have a callback, check if the event type matches
            const eventConfig = this.config;
            if (this.callback && (!eventConfig.eventTypes || eventConfig.eventTypes.length === 0)) {
                await this.callback(this.getId(), TriggerType.EVENT, event);
                return;
            }
            this.logger.warn(0, `No listener for event type: ${event.eventType}`);
            return;
        }
        await listener(event);
    }
    /**
     * 获取队列长度
     */
    getQueueLength() {
        return this.eventQueue.length;
    }
    // ===== 测试兼容方法 =====
    /**
     * 触发事件（测试兼容，同 emitEvent 的简化版本）
     */
    async onEvent(eventType, payload) {
        const event = {
            eventType: eventType,
            source: 'test',
            timestamp: new Date(),
            payload
        };
        await this.emitEvent(event);
    }
}
//# sourceMappingURL=event-trigger.js.map