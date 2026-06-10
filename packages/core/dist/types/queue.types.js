export var QueueItemStatus;
(function (QueueItemStatus) {
    QueueItemStatus["PENDING"] = "pending";
    QueueItemStatus["PROCESSING"] = "processing";
    QueueItemStatus["COMPLETED"] = "completed";
    QueueItemStatus["FAILED"] = "failed";
    QueueItemStatus["RETRY"] = "retry";
})(QueueItemStatus || (QueueItemStatus = {}));
export const DEFAULT_QUEUE_CONFIG = {
    maxSize: 10000,
    maxRetries: 5,
    retryDelay: 1000,
    maxRetryDelay: 60000,
    processingTimeout: 30000,
    batchSize: 10,
    persistenceEnabled: true
};
//# sourceMappingURL=queue.types.js.map