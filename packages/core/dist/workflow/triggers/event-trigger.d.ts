/**
 * Event触发器 - 事件触发器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerConfig } from '../types';
import { BaseTrigger, TriggerCallback } from './base-trigger';
/**
 * 事件类型
 */
export declare enum EventType {
    GIT_PUSH = "git_push",
    GIT_MERGE = "git_merge",
    GIT_PULL_REQUEST = "git_pull_request",
    USER_ACTION = "user_action",
    SYSTEM_STARTUP = "system_startup",
    SYSTEM_SHUTDOWN = "system_shutdown",
    WORKFLOW_CREATED = "workflow_created",
    WORKFLOW_COMPLETED = "workflow_completed",
    FILE_CHANGED = "file_changed",
    CUSTOM = "custom"
}
/**
 * 事件配置
 */
export interface EventConfig {
    eventTypes: EventType[];
    filter?: EventFilter;
    callback?: TriggerCallback;
}
/**
 * 事件过滤器
 */
export interface EventFilter {
    source?: string;
    pattern?: string;
    conditions?: Record<string, any>;
}
/**
 * 事件数据
 */
export interface EventData {
    eventType: EventType;
    source: string;
    timestamp: Date;
    payload: any;
}
/**
 * Event触发器
 */
export declare class EventTrigger extends BaseTrigger {
    private logger;
    private callback?;
    private eventQueue;
    private isProcessing;
    private eventListeners;
    constructor(config: TriggerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    setCallback(callback: TriggerCallback): void;
    /**
     * 注册事件监听器
     */
    private registerEventListener;
    /**
     * 注销事件监听器
     */
    private unregisterEventListener;
    /**
     * 处理事件
     */
    private handleEvent;
    /**
     * 匹配过滤器
     */
    private matchesFilter;
    /**
     * 处理事件队列
     */
    private processEventQueue;
    /**
     * 手动触发事件
     */
    emitEvent(event: EventData): Promise<void>;
    /**
     * 获取队列长度
     */
    getQueueLength(): number;
    /**
     * 触发事件（测试兼容，同 emitEvent 的简化版本）
     */
    onEvent(eventType: string, payload?: any): Promise<void>;
}
//# sourceMappingURL=event-trigger.d.ts.map