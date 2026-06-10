// Offline queue for cloud sync operations
// Queues all push operations locally, retries on reconnect
// Strategy: JSON-file or SQLite persistence, exponential backoff, last-write-wins merge
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
export class OfflineQueue {
    items = [];
    dbPath;
    db;
    maxRetries;
    baseDelayMs;
    maxDelayMs;
    flushTimer = null;
    flushing = false;
    onFlush;
    onError;
    _sqliteInitialized = false;
    constructor(options = {}) {
        this.dbPath = options.dbPath || ':memory:';
        this.db = options.db;
        this.maxRetries = options.maxRetries ?? 5;
        this.baseDelayMs = options.baseDelayMs ?? 1000;
        this.maxDelayMs = options.maxDelayMs ?? 60000;
        this.onFlush = options.onFlush;
        this.onError = options.onError;
        this._load();
    }
    enqueue(type, action, payload) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const item = {
            id,
            type,
            action,
            payload,
            createdAt: Date.now(),
            retries: 0,
            maxRetries: this.maxRetries,
            nextRetryAt: Date.now(),
        };
        this.items.push(item);
        this._save();
        return id;
    }
    getPending() {
        return this.items
            .filter(i => i.retries < i.maxRetries && i.nextRetryAt <= Date.now())
            .sort((a, b) => a.createdAt - b.createdAt);
    }
    get size() {
        return this.items.filter(i => i.retries < i.maxRetries).length;
    }
    get totalSize() {
        return this.items.length;
    }
    ack(id) {
        const idx = this.items.findIndex(i => i.id === id);
        if (idx !== -1) {
            this.items.splice(idx, 1);
            this._save();
        }
    }
    nack(id, error) {
        const item = this.items.find(i => i.id === id);
        if (!item)
            return;
        item.retries++;
        const delay = Math.min(this.baseDelayMs * Math.pow(2, item.retries - 1), this.maxDelayMs);
        item.nextRetryAt = Date.now() + delay;
        this._save();
        if (error && this.onError) {
            this.onError(item, error);
        }
    }
    setFlushHandler(fn) {
        this.onFlush = fn;
    }
    setErrorHandler(fn) {
        this.onError = fn;
    }
    async flush() {
        if (this.flushing)
            return { succeeded: 0, failed: 0 };
        this.flushing = true;
        const pending = this.getPending();
        let succeeded = 0;
        let failed = 0;
        const deduped = this._dedupe(pending);
        for (const item of deduped) {
            try {
                if (this.onFlush) {
                    await this.onFlush([item]);
                }
                this.ack(item.id);
                succeeded++;
            }
            catch (err) {
                this.nack(item.id, err instanceof Error ? err : new Error(String(err)));
                failed++;
            }
        }
        this.flushing = false;
        return { succeeded, failed };
    }
    startPeriodicFlush(intervalMs = 5000) {
        this.stopPeriodicFlush();
        const tick = () => {
            if (this.getPending().length > 0) {
                this.flush().catch(() => { });
            }
            this.flushTimer = setTimeout(tick, intervalMs);
        };
        this.flushTimer = setTimeout(tick, intervalMs);
    }
    stopPeriodicFlush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
    }
    clear() {
        this.items = [];
        this._save();
    }
    clearFile() {
        this.clear();
        if (this.dbPath !== ':memory:' && existsSync(this.dbPath)) {
            try {
                writeFileSync(this.dbPath, '[]', 'utf-8');
            }
            catch { /* ignore */ }
        }
    }
    getStats() {
        const pending = this.items.filter(i => i.retries < i.maxRetries);
        const failed = this.items.filter(i => i.retries >= i.maxRetries);
        const oldest = pending.length > 0
            ? pending.reduce((min, i) => Math.min(min, i.createdAt), Infinity)
            : null;
        return {
            total: this.items.length,
            pending: pending.length,
            failed: failed.length,
            oldestMs: oldest ? Date.now() - oldest : null,
        };
    }
    _dedupe(items) {
        const seen = new Map();
        for (const item of items) {
            const key = `${item.type}:${item.action}:${JSON.stringify(item.payload)}`;
            const existing = seen.get(key);
            if (!existing || item.createdAt > existing.createdAt) {
                seen.set(key, item);
            }
        }
        return [...seen.values()];
    }
    _initSqlite() {
        if (this._sqliteInitialized || !this.db)
            return;
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retries INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 5,
        next_retry_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_offline_queue_pending
        ON offline_queue(next_retry_at, retries);
    `);
        this._sqliteInitialized = true;
    }
    _save() {
        if (this.db) {
            this._saveSqlite();
        }
        else if (this.dbPath !== ':memory:') {
            this._saveJson();
        }
    }
    _load() {
        if (this.db) {
            this._loadSqlite();
        }
        else if (this.dbPath !== ':memory:' && existsSync(this.dbPath)) {
            this._loadJson();
        }
    }
    _saveJson() {
        try {
            const dir = dirname(this.dbPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(this.dbPath, JSON.stringify(this.items), 'utf-8');
        }
        catch { /* ignore */ }
    }
    _loadJson() {
        try {
            const data = readFileSync(this.dbPath, 'utf-8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                this.items = parsed;
            }
        }
        catch { /* ignore */ }
    }
    _saveSqlite() {
        if (!this.db)
            return;
        try {
            this._initSqlite();
            this.db.exec('DELETE FROM offline_queue');
            const stmt = this.db.prepare(`INSERT INTO offline_queue (id, type, action, payload, created_at, retries, max_retries, next_retry_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const item of this.items) {
                stmt.run(item.id, item.type, item.action, JSON.stringify(item.payload), item.createdAt, item.retries, item.maxRetries, item.nextRetryAt);
            }
        }
        catch { /* ignore */ }
    }
    _loadSqlite() {
        if (!this.db)
            return;
        try {
            this._initSqlite();
            const rows = this.db.all('SELECT * FROM offline_queue ORDER BY created_at ASC');
            this.items = rows.map((row) => ({
                id: row.id,
                type: row.type,
                action: row.action,
                payload: JSON.parse(row.payload),
                createdAt: row.created_at,
                retries: row.retries,
                maxRetries: row.max_retries,
                nextRetryAt: row.next_retry_at,
            }));
        }
        catch {
            this.items = [];
        }
    }
}
/** Conflict resolution strategies */
export const MergeStrategy = {
    lastWriteWins: (local, remote) => {
        const localTime = local.updated_at || local.created_at || '';
        const remoteTime = remote.updated_at || remote.created_at || '';
        return remoteTime >= localTime ? remote : local;
    },
    appendMessages: (local, remote) => {
        const localIds = new Set(local.map((m) => m.id || JSON.stringify(m)));
        const remoteNew = remote.filter((m) => !localIds.has(m.id || JSON.stringify(m)));
        return [...local, ...remoteNew];
    },
    deepMerge: (local, remote) => {
        const result = { ...local };
        for (const key of Object.keys(remote)) {
            if (typeof remote[key] === 'object' && remote[key] !== null && !Array.isArray(remote[key])) {
                result[key] = MergeStrategy.deepMerge(local[key] || {}, remote[key]);
            }
            else {
                result[key] = remote[key];
            }
        }
        return result;
    },
};
//# sourceMappingURL=offline-queue.js.map