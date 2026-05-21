import { MetricsCollector } from './metrics.js';
import { logger } from '../../utils/logger.js';
const HANDLER_TIMEOUT = 100;
function generateId() {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
export class EventBus {
    subscribers = new Map();
    globalFilters = [];
    metrics = new MetricsCollector();
    publish(topic, data, source) {
        const event = {
            topic,
            data,
            timestamp: Date.now(),
            source,
            id: generateId(),
        };
        this.metrics.recordPublished();
        for (const filter of this.globalFilters) {
            if (!filter(event)) {
                return;
            }
        }
        const topicSubscribers = this.subscribers.get(topic);
        if (!topicSubscribers || topicSubscribers.size === 0) {
            return;
        }
        const sorted = Array.from(topicSubscribers).sort((a, b) => a.priority - b.priority);
        for (const sub of sorted) {
            if (sub.filter && !sub.filter(event)) {
                continue;
            }
            const startMs = Date.now();
            try {
                const result = sub.handler(event);
                if (result instanceof Promise) {
                    Promise.race([
                        result,
                        new Promise((_, reject) => setTimeout(() => reject(new Error('handler timeout')), HANDLER_TIMEOUT)),
                    ]).then(() => {
                        this.metrics.recordDelivered(Date.now() - startMs);
                    }).catch((err) => {
                        this.metrics.recordError();
                        logger.warn(`[EventBus] handler error on "${topic}": ${err.message}`);
                    });
                }
                else {
                    this.metrics.recordDelivered(Date.now() - startMs);
                }
            }
            catch {
                this.metrics.recordError();
            }
        }
    }
    subscribe(topic, handler, options) {
        const priority = options?.priority ?? 0;
        const filter = options?.filter;
        const once = options?.once;
        let actualHandler = handler;
        if (once) {
            let called = false;
            const originalHandler = handler;
            actualHandler = ((event) => {
                if (called)
                    return;
                called = true;
                unsub();
                return originalHandler(event);
            });
        }
        const subscriber = {
            handler: actualHandler,
            priority,
            filter,
        };
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, new Set());
        }
        this.subscribers.get(topic).add(subscriber);
        const unsub = () => {
            const set = this.subscribers.get(topic);
            if (set) {
                set.delete(subscriber);
                if (set.size === 0) {
                    this.subscribers.delete(topic);
                }
            }
        };
        return unsub;
    }
    addFilter(filter) {
        this.globalFilters.push(filter);
    }
    healthCheck() {
        const m = this.metrics.getMetrics();
        return {
            healthy: m.totalErrors < m.totalDelivered * 0.5,
            metrics: m,
        };
    }
}
//# sourceMappingURL=event-bus.js.map