export interface OfflineQueueItem {
    id: string;
    type: string;
    action: string;
    payload: any;
    createdAt: number;
    retries: number;
    maxRetries: number;
    nextRetryAt: number;
}
export interface OfflineQueueOptions {
    dbPath?: string;
    db?: any;
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onFlush?: (items: OfflineQueueItem[]) => Promise<void>;
    onError?: (item: OfflineQueueItem, error: Error) => void;
}
export declare class OfflineQueue {
    items: OfflineQueueItem[];
    dbPath: string;
    db: any;
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    flushTimer: ReturnType<typeof setTimeout> | null;
    flushing: boolean;
    onFlush?: (items: OfflineQueueItem[]) => Promise<void>;
    onError?: (item: OfflineQueueItem, error: Error) => void;
    private _sqliteInitialized;
    constructor(options?: OfflineQueueOptions);
    enqueue(type: string, action: string, payload: any): string;
    getPending(): OfflineQueueItem[];
    get size(): number;
    get totalSize(): number;
    ack(id: string): void;
    nack(id: string, error?: Error): void;
    setFlushHandler(fn: (items: OfflineQueueItem[]) => Promise<void>): void;
    setErrorHandler(fn: (item: OfflineQueueItem, error: Error) => void): void;
    flush(): Promise<{
        succeeded: number;
        failed: number;
    }>;
    startPeriodicFlush(intervalMs?: number): void;
    stopPeriodicFlush(): void;
    clear(): void;
    clearFile(): void;
    getStats(): {
        total: number;
        pending: number;
        failed: number;
        oldestMs: number | null;
    };
    private _dedupe;
    private _initSqlite;
    private _save;
    private _load;
    private _saveJson;
    private _loadJson;
    private _saveSqlite;
    private _loadSqlite;
}
/** Conflict resolution strategies */
export declare const MergeStrategy: {
    lastWriteWins: (local: any, remote: any) => any;
    appendMessages: (local: any[], remote: any[]) => any[];
    deepMerge: (local: any, remote: any) => any;
};
//# sourceMappingURL=offline-queue.d.ts.map