export type EventTopic = 'agent:message_start' | 'agent:message_end' | 'agent:tool_call' | 'agent:tool_result' | 'agent:compaction' | 'memory:updated' | 'memory:window_compacted' | 'vector:synced' | 'review:completed' | 'review:failed' | 'skill:loaded' | 'skill:blocked' | 'skill:executed' | 'dag:completed' | 'dag:failed' | 'dag:node_completed' | 'parallel:completed' | 'model:fallback' | 'user_model:updated' | 'cron:registered' | 'cron:executed';
export interface EventMessage<T = unknown> {
    topic: EventTopic;
    data: T;
    timestamp: number;
    source: string;
    id: string;
}
export interface EventHandler<T = unknown> {
    (event: EventMessage<T>): void | Promise<void>;
}
export interface SubscribeOptions {
    priority?: number;
    filter?: EventFilter;
    once?: boolean;
}
export type EventFilter = (event: EventMessage) => boolean;
export type UnsubscribeFn = () => void;
export interface EventBusMetrics {
    totalPublished: number;
    totalDelivered: number;
    totalErrors: number;
    avgDeliveryMs: number;
    throughputPerSec: number;
}
export interface IEventBus {
    publish<T>(topic: EventTopic, data: T, source: string): void;
    subscribe<T>(topic: EventTopic, handler: EventHandler<T>, options?: SubscribeOptions): UnsubscribeFn;
    addFilter(filter: EventFilter): void;
    healthCheck(): {
        healthy: boolean;
        metrics: EventBusMetrics;
    };
}
//# sourceMappingURL=types.d.ts.map