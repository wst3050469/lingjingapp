import type { OfflineQueueItem, OfflineQueueStats, QueueConfig, QueueProcessingResult, QueueEventHandlers } from '../types/queue.types.js';
export declare class OfflineQueue {
    private config;
    private handlers;
    private processing;
    private processingInterval?;
    constructor(config?: Partial<QueueConfig>, handlers?: QueueEventHandlers);
    enqueue(operation: string, payload: unknown, priority?: number, metadata?: Record<string, unknown>): Promise<OfflineQueueItem>;
    dequeue(batchSize?: number): Promise<OfflineQueueItem[]>;
    markCompleted(itemId: string): Promise<void>;
    markFailed(itemId: string, error: string): Promise<void>;
    processQueue(processor: (item: OfflineQueueItem) => Promise<void>): Promise<QueueProcessingResult>;
    getStats(): Promise<OfflineQueueStats>;
    clear(): Promise<void>;
    startAutoProcess(processor: (item: OfflineQueueItem) => Promise<void>, interval?: number): void;
    stopAutoProcess(): void;
    private getItem;
    private rowToItem;
}
//# sourceMappingURL=offline-queue.d.ts.map