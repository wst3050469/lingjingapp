export declare enum QueueItemStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    RETRY = "retry"
}
export interface OfflineQueueItem {
    id: string;
    operation: string;
    payload: unknown;
    timestamp: number;
    status: QueueItemStatus;
    retryCount: number;
    maxRetries: number;
    nextRetryAt?: number;
    lastError?: string;
    priority: number;
    metadata?: Record<string, unknown>;
}
export interface OfflineQueueStats {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    oldestItem?: number;
    newestItem?: number;
}
export interface QueueConfig {
    maxSize: number;
    maxRetries: number;
    retryDelay: number;
    maxRetryDelay: number;
    processingTimeout: number;
    batchSize: number;
    persistenceEnabled: boolean;
}
export interface QueueProcessingResult {
    processed: number;
    succeeded: number;
    failed: number;
    retried: number;
    errors: Array<{
        itemId: string;
        error: string;
    }>;
}
export declare const DEFAULT_QUEUE_CONFIG: QueueConfig;
export interface QueueEventHandlers {
    onItemAdded?: (item: OfflineQueueItem) => void;
    onItemProcessed?: (item: OfflineQueueItem, success: boolean) => void;
    onQueueDrained?: () => void;
    onError?: (error: Error, item?: OfflineQueueItem) => void;
}
//# sourceMappingURL=queue.types.d.ts.map