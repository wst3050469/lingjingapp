import { logger } from '../../utils/logger.js';
export class SQLiteStorageBackend {
    type = 'sqlite';
    db;
    initialized = false;
    constructor(db) {
        this.db = db;
    }
    init() {
        if (this.initialized)
            return;
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        snapshot_version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_session ON session_snapshots(session_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_created ON session_snapshots(created_at);

      CREATE TABLE IF NOT EXISTS incremental_snapshots (
        incremental_id TEXT PRIMARY KEY,
        base_snapshot_id TEXT NOT NULL,
        deltas TEXT NOT NULL,
        checksum TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_incremental_base ON incremental_snapshots(base_snapshot_id);
    `);
        this.initialized = true;
    }
    async save(key, data) {
        this.init();
        const now = Date.now();
        const json = JSON.stringify(data);
        const existing = this.db.get('SELECT snapshot_id FROM session_snapshots WHERE snapshot_id = ?', [key]);
        if (existing) {
            this.db.run('UPDATE session_snapshots SET data = ?, updated_at = ? WHERE snapshot_id = ?', [json, now, key]);
        }
        else {
            const parsed = data;
            this.db.run(`INSERT INTO session_snapshots (snapshot_id, session_id, snapshot_version, status, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                key,
                parsed.sessionId ?? key,
                parsed.snapshotVersion ?? '2.0.0',
                parsed.status ?? 'active',
                json,
                now,
                now,
            ]);
        }
    }
    async load(key) {
        this.init();
        const row = this.db.get('SELECT data FROM session_snapshots WHERE snapshot_id = ?', [key]);
        if (!row)
            return null;
        try {
            return JSON.parse(row.data);
        }
        catch {
            logger.error(`SQLiteStorageBackend: Failed to parse data for ${key}`);
            return null;
        }
    }
    async delete(key) {
        this.init();
        const result = this.db.run('DELETE FROM session_snapshots WHERE snapshot_id = ?', [key]);
        return result.changes > 0;
    }
    async list() {
        this.init();
        const rows = this.db.all('SELECT snapshot_id FROM session_snapshots ORDER BY created_at DESC');
        return rows.map(r => r.snapshot_id);
    }
    async exists(key) {
        this.init();
        const row = this.db.get('SELECT snapshot_id FROM session_snapshots WHERE snapshot_id = ?', [key]);
        return !!row;
    }
}
//# sourceMappingURL=sqlite-backend.js.map