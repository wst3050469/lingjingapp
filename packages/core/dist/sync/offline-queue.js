import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../electron-deps/database.js';
import { DEFAULT_QUEUE_CONFIG, QueueItemStatus } from '../types/queue.types.js';
export class OfflineQueue {
    config;
    handlers;
    processing = false;
    processingInterval;
    constructor(config = {}, handlers = {}) {
        this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
        this.handlers = handlers;
    }
    async enqueue(operation, payload, priority = 0, metadata) {
        const db = getDatabase();
        const item = {
            id: uuidv4(),
            operation,
            payload,
            timestamp: Date.now(),
            status: QueueItemStatus.PENDING,
            retryCount: 0,
            maxRetries: this.config.maxRetries,
            priority,
            metadata
        };
        db.run(`INSERT INTO offline_queue (
        id, operation, payload, timestamp, status, retry_count, max_retries, priority, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            item.id,
            item.operation,
            JSON.stringify(item.payload),
            item.timestamp,
            item.status,
            item.retryCount,
            item.maxRetries,
            item.priority,
            metadata ? JSON.stringify(metadata) : null
        ]);
        await saveDatabase();
        this.handlers.onItemAdded?.(item);
        console.log(`[OfflineQueue] Enqueued operation: ${operation} (${item.id})`);
        return item;
    }
    async dequeue(batchSize = this.config.batchSize) {
        const db = getDatabase();
        const now = Date.now();
        const rows = db.exec(`SELECT * FROM offline_queue
       WHERE status = 'pending' 
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY priority DESC, timestamp ASC
       LIMIT ?`, [now, batchSize]);
        if (rows.length === 0 || rows[0].values.length === 0) {
            return [];
        }
        const items = rows[0].values.map((row) => this.rowToItem(row));
        for (const item of items) {
            db.run(`UPDATE offline_queue SET status = 'processing', updated_at = datetime('now') WHERE id = ?`, [item.id]);
        }
        await saveDatabase();
        return items;
    }
    async markCompleted(itemId) {
        const db = getDatabase();
        db.run(`UPDATE offline_queue 
       SET status = 'completed', updated_at = datetime('now')
       WHERE id = ?`, [itemId]);
        await saveDatabase();
        const item = await this.getItem(itemId);
        if (item) {
            this.handlers.onItemProcessed?.(item, true);
        }
    }
    async markFailed(itemId, error) {
        const db = getDatabase();
        const item = await this.getItem(itemId);
        if (!item)
            return;
        const newRetryCount = item.retryCount + 1;
        if (newRetryCount >= item.maxRetries) {
            db.run(`UPDATE offline_queue 
         SET status = 'failed', last_error = ?, updated_at = datetime('now')
         WHERE id = ?`, [error, itemId]);
        }
        else {
            const nextRetryDelay = Math.min(this.config.retryDelay * Math.pow(2, newRetryCount), this.config.maxRetryDelay);
            const nextRetryAt = Date.now() + nextRetryDelay;
            db.run(`UPDATE offline_queue 
         SET status = 'retry', 
             retry_count = ?, 
             next_retry_at = ?,
             last_error = ?,
             updated_at = datetime('now')
         WHERE id = ?`, [newRetryCount, nextRetryAt, error, itemId]);
        }
        await saveDatabase();
        this.handlers.onItemProcessed?.(item, false);
        this.handlers.onError?.(new Error(error), item);
    }
    async processQueue(processor) {
        if (this.processing) {
            return { processed: 0, succeeded: 0, failed: 0, retried: 0, errors: [] };
        }
        this.processing = true;
        const result = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            retried: 0,
            errors: []
        };
        try {
            const items = await this.dequeue();
            for (const item of items) {
                try {
                    await processor(item);
                    await this.markCompleted(item.id);
                    result.succeeded++;
                }
                catch (err) {
                    const error = err instanceof Error ? err.message : String(err);
                    await this.markFailed(item.id, error);
                    result.failed++;
                    result.errors.push({ itemId: item.id, error });
                }
                result.processed++;
            }
            if (result.processed === 0) {
                this.handlers.onQueueDrained?.();
            }
        }
        finally {
            this.processing = false;
        }
        return result;
    }
    async getStats() {
        const db = getDatabase();
        const rows = db.exec(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      FROM offline_queue
    `);
        if (rows.length === 0 || rows[0].values.length === 0) {
            return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
        }
        const [total, pending, processing, completed, failed, oldest, newest] = rows[0].values[0];
        return {
            total: total,
            pending: pending,
            processing: processing,
            completed: completed,
            failed: failed,
            oldestItem: oldest,
            newestItem: newest
        };
    }
    async clear() {
        const db = getDatabase();
        db.run(`DELETE FROM offline_queue`);
        await saveDatabase();
    }
    startAutoProcess(processor, interval = 5000) {
        this.stopAutoProcess();
        this.processingInterval = setInterval(async () => {
            await this.processQueue(processor);
        }, interval);
    }
    stopAutoProcess() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = undefined;
        }
    }
    async getItem(itemId) {
        const db = getDatabase();
        const rows = db.exec(`SELECT * FROM offline_queue WHERE id = ?`, [itemId]);
        if (rows.length === 0 || rows[0].values.length === 0) {
            return null;
        }
        return this.rowToItem(rows[0].values[0]);
    }
    rowToItem(row) {
        return {
            id: row[0],
            operation: row[1],
            payload: JSON.parse(row[2]),
            timestamp: row[3],
            status: row[4],
            retryCount: row[5],
            maxRetries: row[6],
            nextRetryAt: row[7],
            lastError: row[8],
            priority: row[9],
            metadata: row[10] ? JSON.parse(row[10]) : undefined
        };
    }
}
//# sourceMappingURL=offline-queue.js.map