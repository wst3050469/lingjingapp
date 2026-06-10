import { getDatabase, saveDatabase } from './database';

/**
 * Sync tables schema version. Increment when adding/altering tables.
 * Migration functions are keyed by version number and only run when
 * the stored version is lower.
 */
const SYNC_SCHEMA_VERSION = 1;

interface SyncMigration {
  version: number;
  name: string;
  fn: (db: ReturnType<typeof getDatabase>) => void;
}

/**
 * All sync-table migrations, ordered by version.
 * Add new entries here (never modify existing) when schema changes.
 */
const syncMigrations: SyncMigration[] = [
  {
    version: 1,
    name: 'initial_sync_tables',
    fn: createSyncTablesV1,
  },
];

function createSyncTablesV1(db: ReturnType<typeof getDatabase>): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_data (
      id TEXT PRIMARY KEY,
      data_type TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      version INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      checksum TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('synced', 'pending', 'syncing', 'conflict', 'error', 'offline')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_data_type ON sync_data(data_type);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_data_status ON sync_data(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_data_timestamp ON sync_data(timestamp);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_data_device ON sync_data(device_id);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 5,
      next_retry_at INTEGER,
      last_error TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_offline_queue_retry ON offline_queue(next_retry_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_offline_queue_priority ON offline_queue(priority);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS github_accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT NOT NULL DEFAULT 'bearer',
      scope TEXT NOT NULL,
      expires_at INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'revoked', 'pending')),
      added_at INTEGER NOT NULL,
      last_used_at INTEGER,
      is_default INTEGER NOT NULL DEFAULT 0,
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_github_accounts_username ON github_accounts(username);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_github_accounts_status ON github_accounts(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_github_accounts_default ON github_accounts(is_default);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      conflict_type TEXT NOT NULL CHECK(conflict_type IN ('update_update', 'update_delete', 'delete_update', 'duplicate_create', 'version_mismatch')),
      data_id TEXT NOT NULL,
      data_type TEXT NOT NULL,
      local_version TEXT NOT NULL,
      remote_version TEXT NOT NULL,
      local_timestamp INTEGER NOT NULL,
      remote_timestamp INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolution_strategy TEXT CHECK(resolution_strategy IN ('auto_merge', 'local_win', 'remote_win', 'manual', 'timestamp')),
      resolved_data TEXT,
      resolved_by TEXT,
      resolved_at INTEGER,
      resolution_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_conflicts_data_id ON sync_conflicts(data_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_conflicts_type ON sync_conflicts(conflict_type);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS file_sync_items (
      id TEXT PRIMARY KEY,
      local_path TEXT NOT NULL,
      remote_file_id TEXT,
      size INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      last_modified INTEGER NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'uploading', 'downloading', 'conflict')),
      last_sync_at INTEGER,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_file_sync_path ON file_sync_items(local_path);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_file_sync_status ON file_sync_items(sync_status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_file_sync_remote ON file_sync_items(remote_file_id);`);
}

export async function initSyncTables(): Promise<void> {
  const db = getDatabase();

  try {
    // DB-002: Schema version tracking for sync tables
    db.run(`
      CREATE TABLE IF NOT EXISTS sync_schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Determine current sync schema version
    let currentVersion = 0;
    const res = db.exec('SELECT MAX(version) FROM sync_schema_version');
    if (res.length > 0 && res[0].values[0][0] !== null) {
      currentVersion = res[0].values[0][0] as number;
    }
    console.log(`[SyncDB] Current sync schema version: ${currentVersion}`);

    // Legacy detection: if sync_data table exists but sync_schema_version is at 0,
    // assume v1 is already applied (tables were created by old initSyncTables).
    const hasSyncData = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_data'"
    );
    if (hasSyncData.length > 0 && currentVersion < 1) {
      console.log('[SyncDB] Legacy sync tables detected, marking as v1');
      db.run("INSERT INTO sync_schema_version (version, name) VALUES (1, 'initial_sync_tables')");
      currentVersion = 1;
    }

    // Apply pending migrations
    const pending = syncMigrations
      .filter(m => m.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    for (const migration of pending) {
      console.log(`[SyncDB] Applying sync migration v${migration.version}: ${migration.name}`);
      migration.fn(db);
      db.run(
        `INSERT INTO sync_schema_version (version, name) VALUES (${migration.version}, '${migration.name}')`
      );
      console.log(`[SyncDB] Sync migration v${migration.version} applied successfully.`);
    }

    await saveDatabase();
    console.log('[SyncDB] Cloud sync tables initialized successfully');
  } catch (err) {
    console.error('[SyncDB] Failed to initialize sync tables:', err);
    throw err;
  }
}
