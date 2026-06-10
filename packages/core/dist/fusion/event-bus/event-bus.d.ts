import { EventTopic, EventHandler, SubscribeOptions, EventFilter, UnsubscribeFn, IEventBus, EventBusMetrics } from './types.js';
export declare class EventBus implements IEventBus {
    private subscribers;
    private globalFilters;
    private metrics;
    publish<T>(topic: EventTopic, data: T, source: string): void;
    subscribe<T>(topic: EventTopic, handler: EventHandler<T>, options?: SubscribeOptions): UnsubscribeFn;
    addFilter(filter: EventFilter): void;
    healthCheck(): {
        healthy: boolean;
        metrics: EventBusMetrics;
    };
}
//# sourceMappingURL=event-bus.d.ts.map