"use strict";
// Offline queue for cloud sync operations
// Queues all push operations locally, retries on reconnect
// Strategy: JSON-file or SQLite persistence, exponential backoff, last-write-wins merge
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeStrategy = exports.OfflineQueue = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object')
        return JSON.stringify(obj);
    try {
        const keys = Object.keys(obj).sort();
        const sorted = {};
        for (const k of keys)
            sorted[k] = obj[k];
        return JSON.stringify(sorted, (_, v) => {
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
                const sk = Object.keys(v).sort();
                const sv = {};
                for (const k of sk)
                    sv[k] = v[k];
                return sv;
            }
            return v;
        });
    }
    catch {
        return JSON.stringify(obj);
    }
}
function generateId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    const rand2 = Math.random().toString(36).slice(2, 6);
    return `${ts}-${rand}-${rand2}`;
}
class OfflineQueue {
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
        const id = generateId();
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
            return { succeeded: 0, failed: 0, skipped: true };
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
                if (this.items.some(i => i.id === item.id)) {
                    this.ack(item.id);
                }
                succeeded++;
            }
            catch (err) {
                if (this.items.some(i => i.id === item.id)) {
                    this.nack(item.id, err instanceof Error ? err : new Error(String(err)));
                }
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
        if (this.dbPath !== ':memory:' && (0, fs_1.existsSync)(this.dbPath)) {
            try {
                (0, fs_1.writeFileSync)(this.dbPath, '[]', 'utf-8');
            }
            catch (err) {
                console.warn('[OfflineQueue] Failed to clear file:', err instanceof Error ? err.message : String(err));
            }
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
        const toRemove = [];
        for (const item of items) {
            try {
                const key = `${item.type}:${item.action}:${stableStringify(item.payload)}`;
                const existing = seen.get(key);
                if (!existing) {
                    seen.set(key, item);
                }
                else if (item.createdAt > existing.createdAt) {
                    toRemove.push(existing.id);
                    seen.set(key, item);
                }
                else {
                    toRemove.push(item.id);
                }
            }
            catch {
                seen.set(item.id, item);
            }
        }
        for (const id of toRemove) {
            this.ack(id);
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
        else if (this.dbPath !== ':memory:' && (0, fs_1.existsSync)(this.dbPath)) {
            this._loadJson();
        }
    }
    _saveJson() {
        try {
            const dir = (0, path_1.dirname)(this.dbPath);
            if (!(0, fs_1.existsSync)(dir)) {
                (0, fs_1.mkdirSync)(dir, { recursive: true });
            }
            (0, fs_1.writeFileSync)(this.dbPath, JSON.stringify(this.items), 'utf-8');
        }
        catch (err) {
            console.error('[OfflineQueue] JSON save failed:', err instanceof Error ? err.message : String(err));
        }
    }
    _loadJson() {
        try {
            const data = (0, fs_1.readFileSync)(this.dbPath, 'utf-8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                this.items = parsed;
            }
        }
        catch (err) {
            console.warn('[OfflineQueue] JSON load failed, starting fresh:', err instanceof Error ? err.message : String(err));
            this.items = [];
        }
    }
    _saveSqlite() {
        if (!this.db)
            return;
        try {
            this._initSqlite();
            this.db.exec('BEGIN TRANSACTION');
            this.db.exec('DELETE FROM offline_queue');
            const stmt = this.db.prepare(`INSERT INTO offline_queue (id, type, action, payload, created_at, retries, max_retries, next_retry_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const item of this.items) {
                stmt.run(item.id, item.type, item.action, JSON.stringify(item.payload), item.createdAt, item.retries, item.maxRetries, item.nextRetryAt);
            }
            this.db.exec('COMMIT');
        }
        catch (err) {
            try {
                this.db.exec('ROLLBACK');
            }
            catch { /* rollback failed */ }
            console.error('[OfflineQueue] SQLite save failed:', err instanceof Error ? err.message : String(err));
        }
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
        catch (err) {
            console.warn('[OfflineQueue] SQLite load failed:', err instanceof Error ? err.message : String(err));
            this.items = [];
        }
    }
}
exports.OfflineQueue = OfflineQueue;
/** Conflict resolution strategies */
exports.MergeStrategy = {
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
        if (local === null || typeof local !== 'object' || Array.isArray(local))
            return remote;
        if (remote === null || typeof remote !== 'object' || Array.isArray(remote))
            return remote;
        const result = { ...local };
        for (const key of Object.keys(remote)) {
            if (typeof remote[key] === 'object' && remote[key] !== null && !Array.isArray(remote[key])
                && typeof local[key] === 'object' && local[key] !== null && !Array.isArray(local[key])) {
                result[key] = exports.MergeStrategy.deepMerge(local[key], remote[key]);
            }
            else {
                result[key] = remote[key];
            }
        }
        return result;
    },
};
//# sourceMappingURL=offline-queue.js.map