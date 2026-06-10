import { EventTopic, EventMessage, EventHandler, SubscribeOptions, EventFilter, UnsubscribeFn, IEventBus, EventBusMetrics } from './types.js';
import { MetricsCollector } from './metrics.js';
import { logger } from '../../utils/logger.js';

interface Subscriber {
  handler: EventHandler;
  priority: number;
  filter?: EventFilter;
}

const HANDLER_TIMEOUT = 100;

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export class EventBus implements IEventBus {
  private subscribers = new Map<string, Set<Subscriber>>();
  private globalFilters: EventFilter[] = [];
  private metrics = new MetricsCollector();

  publish<T>(topic: EventTopic, data: T, source: string): void {
    const event: EventMessage<T> = {
      topic,
      data,
      timestamp: Date.now(),
      source,
      id: generateId(),
    };

    this.metrics.recordPublished();

    for (const filter of this.globalFilters) {
      if (!filter(event as EventMessage)) {
        return;
      }
    }

    const topicSubscribers = this.subscribers.get(topic);
    if (!topicSubscribers || topicSubscribers.size === 0) {
      return;
    }

    const sorted = Array.from(topicSubscribers).sort((a, b) => a.priority - b.priority);

    for (const sub of sorted) {
      if (sub.filter && !sub.filter(event as EventMessage)) {
        continue;
      }

      const startMs = Date.now();
      try {
        const result = sub.handler(event as EventMessage);
        if (result instanceof Promise) {
          Promise.race([
            result,
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('handler timeout')), HANDLER_TIMEOUT)
            ),
          ]).then(() => {
            this.metrics.recordDelivered(Date.now() - startMs);
          }).catch((err: Error) => {
            this.metrics.recordError();
            logger.warn(`[EventBus] handler error on "${topic}": ${err.message}`);
          });
        } else {
          this.metrics.recordDelivered(Date.now() - startMs);
        }
      } catch {
        this.metrics.recordError();
      }
    }
  }

  subscribe<T>(topic: EventTopic, handler: EventHandler<T>, options?: SubscribeOptions): UnsubscribeFn {
    const priority = options?.priority ?? 0;
    const filter = options?.filter;
    const once = options?.once;

    let actualHandler = handler;

    if (once) {
      let called = false;
      const originalHandler = handler;
      actualHandler = ((event: EventMessage<T>) => {
        if (called) return;
        called = true;
        unsub();
        return originalHandler(event);
      }) as EventHandler<T>;
    }

    const subscriber: Subscriber = {
      handler: actualHandler as EventHandler,
      priority,
      filter,
    };

    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(subscriber);

    const unsub: UnsubscribeFn = () => {
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

  addFilter(filter: EventFilter): void {
    this.globalFilters.push(filter);
  }

  healthCheck(): { healthy: boolean; metrics: EventBusMetrics } {
    const m = this.metrics.getMetrics();
    return {
      healthy: m.totalErrors < m.totalDelivered * 0.5,
      metrics: m,
    };
  }
}
