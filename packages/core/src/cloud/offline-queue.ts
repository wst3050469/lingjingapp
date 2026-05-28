// Offline queue for cloud sync operations
// Queues all push operations locally, retries on reconnect
// Strategy: JSON-file or SQLite persistence, exponential backoff, last-write-wins merge

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

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

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  try {
    const keys = Object.keys(obj).sort();
    const sorted: any = {};
    for (const k of keys) sorted[k] = obj[k];
    return JSON.stringify(sorted, (_, v) => {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const sk = Object.keys(v).sort();
        const sv: any = {};
        for (const k of sk) sv[k] = v[k];
        return sv;
      }
      return v;
    });
  } catch {
    return JSON.stringify(obj);
  }
}

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const rand2 = Math.random().toString(36).slice(2, 6);
  return `${ts}-${rand}-${rand2}`;
}

export class OfflineQueue {
  items: OfflineQueueItem[] = [];
  dbPath: string;
  db: any;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  flushTimer: ReturnType<typeof setTimeout> | null = null;
  flushing = false;
  onFlush?: (items: OfflineQueueItem[]) => Promise<void>;
  onError?: (item: OfflineQueueItem, error: Error) => void;
  private _sqliteInitialized = false;

  constructor(options: OfflineQueueOptions = {}) {
    this.dbPath = options.dbPath || ':memory:';
    this.db = options.db;
    this.maxRetries = options.maxRetries ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 60000;
    this.onFlush = options.onFlush;
    this.onError = options.onError;
    this._load();
  }

  enqueue(type: string, action: string, payload: any): string {
    const id = generateId();
    const item: OfflineQueueItem = {
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

  getPending(): OfflineQueueItem[] {
    return this.items
      .filter(i => i.retries < i.maxRetries && i.nextRetryAt <= Date.now())
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  get size(): number {
    return this.items.filter(i => i.retries < i.maxRetries).length;
  }

  get totalSize(): number {
    return this.items.length;
  }

  ack(id: string): void {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.items.splice(idx, 1);
      this._save();
    }
  }

  nack(id: string, error?: Error): void {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.retries++;
    const delay = Math.min(this.baseDelayMs * Math.pow(2, item.retries - 1), this.maxDelayMs);
    item.nextRetryAt = Date.now() + delay;
    this._save();
    if (error && this.onError) {
      this.onError(item, error);
    }
  }

  setFlushHandler(fn: (items: OfflineQueueItem[]) => Promise<void>): void {
    this.onFlush = fn;
  }

  setErrorHandler(fn: (item: OfflineQueueItem, error: Error) => void): void {
    this.onError = fn;
  }

  async flush(): Promise<{ succeeded: number; failed: number; skipped?: boolean }> {
    if (this.flushing) return { succeeded: 0, failed: 0, skipped: true };
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
      } catch (err) {
        if (this.items.some(i => i.id === item.id)) {
          this.nack(item.id, err instanceof Error ? err : new Error(String(err)));
        }
        failed++;
      }
    }
    this.flushing = false;
    return { succeeded, failed };
  }

  startPeriodicFlush(intervalMs = 5000): void {
    this.stopPeriodicFlush();
    const tick = () => {
      if (this.getPending().length > 0) {
        this.flush().catch(() => {});
      }
      this.flushTimer = setTimeout(tick, intervalMs);
    };
    this.flushTimer = setTimeout(tick, intervalMs);
  }

  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  clear(): void {
    this.items = [];
    this._save();
  }

  clearFile(): void {
    this.clear();
    if (this.dbPath !== ':memory:' && existsSync(this.dbPath)) {
      try { writeFileSync(this.dbPath, '[]', 'utf-8'); } catch (err) {
        console.warn('[OfflineQueue] Failed to clear file:', err instanceof Error ? err.message : String(err));
      }
    }
  }

  getStats(): { total: number; pending: number; failed: number; oldestMs: number | null } {
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

  private _dedupe(items: OfflineQueueItem[]): OfflineQueueItem[] {
    const seen = new Map<string, OfflineQueueItem>();
    const toRemove: string[] = [];
    for (const item of items) {
      try {
        const key = `${item.type}:${item.action}:${stableStringify(item.payload)}`;
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, item);
        } else if (item.createdAt > existing.createdAt) {
          toRemove.push(existing.id);
          seen.set(key, item);
        } else {
          toRemove.push(item.id);
        }
      } catch {
        seen.set(item.id, item);
      }
    }
    for (const id of toRemove) {
      this.ack(id);
    }
    return [...seen.values()];
  }

  private _initSqlite(): void {
    if (this._sqliteInitialized || !this.db) return;
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

  private _save(): void {
    if (this.db) {
      this._saveSqlite();
    } else if (this.dbPath !== ':memory:') {
      this._saveJson();
    }
  }

  private _load(): void {
    if (this.db) {
      this._loadSqlite();
    } else if (this.dbPath !== ':memory:' && existsSync(this.dbPath)) {
      this._loadJson();
    }
  }

  private _saveJson(): void {
    try {
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.dbPath, JSON.stringify(this.items), 'utf-8');
    } catch (err) {
      console.error('[OfflineQueue] JSON save failed:', err instanceof Error ? err.message : String(err));
    }
  }

  private _loadJson(): void {
    try {
      const data = readFileSync(this.dbPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.items = parsed;
      }
    } catch (err) {
      console.warn('[OfflineQueue] JSON load failed, starting fresh:', err instanceof Error ? err.message : String(err));
      this.items = [];
    }
  }

  private _saveSqlite(): void {
    if (!this.db) return;
    try {
      this._initSqlite();
      this.db.exec('BEGIN TRANSACTION');
      this.db.exec('DELETE FROM offline_queue');
      const stmt = this.db.prepare(
        `INSERT INTO offline_queue (id, type, action, payload, created_at, retries, max_retries, next_retry_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const item of this.items) {
        stmt.run(item.id, item.type, item.action, JSON.stringify(item.payload),
          item.createdAt, item.retries, item.maxRetries, item.nextRetryAt);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      try { this.db.exec('ROLLBACK'); } catch { /* rollback failed */ }
      console.error('[OfflineQueue] SQLite save failed:', err instanceof Error ? err.message : String(err));
    }
  }

  private _loadSqlite(): void {
    if (!this.db) return;
    try {
      this._initSqlite();
      const rows = this.db.all('SELECT * FROM offline_queue ORDER BY created_at ASC');
      this.items = rows.map((row: any) => ({
        id: row.id,
        type: row.type,
        action: row.action,
        payload: JSON.parse(row.payload),
        createdAt: row.created_at,
        retries: row.retries,
        maxRetries: row.max_retries,
        nextRetryAt: row.next_retry_at,
      }));
    } catch (err) {
      console.warn('[OfflineQueue] SQLite load failed:', err instanceof Error ? err.message : String(err));
      this.items = [];
    }
  }
}

/** Conflict resolution strategies */
export const MergeStrategy = {
  lastWriteWins: (local: any, remote: any) => {
    const localTime = local.updated_at || local.created_at || '';
    const remoteTime = remote.updated_at || remote.created_at || '';
    return remoteTime >= localTime ? remote : local;
  },
  appendMessages: (local: any[], remote: any[]) => {
    const localIds = new Set(local.map((m: any) => m.id || JSON.stringify(m)));
    const remoteNew = remote.filter((m: any) => !localIds.has(m.id || JSON.stringify(m)));
    return [...local, ...remoteNew];
  },
  deepMerge: (local: any, remote: any): any => {
    if (local === null || typeof local !== 'object' || Array.isArray(local)) return remote;
    if (remote === null || typeof remote !== 'object' || Array.isArray(remote)) return remote;
    const result = { ...local };
    for (const key of Object.keys(remote)) {
      if (typeof remote[key] === 'object' && remote[key] !== null && !Array.isArray(remote[key])
          && typeof local[key] === 'object' && local[key] !== null && !Array.isArray(local[key])) {
        result[key] = MergeStrategy.deepMerge(local[key], remote[key]);
      } else {
        result[key] = remote[key];
      }
    }
    return result;
  },
};
