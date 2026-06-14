import path from 'path';
import { app } from 'electron';
import { Database, initAdapter } from './sqljs-adapter.js';
import {
  ensureDir,
} from '../utils/fs.js';

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'lingjing.db');
}

let db: Database | null = null;

export function getDatabase(): Database {
  if (db) return db;

  const dbPath = getDatabasePath();
  ensureDir(path.dirname(dbPath));
  // WAL mode + normal synchronous for concurrent safety
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
}

/**
 * Force WAL checkpoint to persist in-memory changes to disk.
 * With sql.js (WASM), data lives in memory; saveDatabase() writes to disk.
 */
export function saveDatabase(): void {
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.save();
  } catch (err) {
    console.error('[DB] Failed to save database:', err);
  }
}

/**
 * Synchronous version of saveDatabase for exit/crash handlers.
 */
export function saveDatabaseSync(): void {
  saveDatabase();
}

/**
 * Initialize database: load SQL.js WASM, open/create DB, run schema migrations.
 * Must be called once at app startup (before any DB operations).
 */
export async function initDatabase(): Promise<void> {
  await initAdapter();
  
  let database: Database;
  try {
    database = getDatabase();
  } catch (err) {
    console.error('[DB] Failed to open database:', err);
    throw err;
  }

  // ─── Schema: core tables ───
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
      content TEXT,
      model TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      token_count INTEGER,
      truncated INTEGER DEFAULT 0,
      compacted_from_ids TEXT
    );

    CREATE TABLE IF NOT EXISTS code_edits (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      original_content TEXT NOT NULL,
      new_content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      accepted INTEGER DEFAULT 0,
      diff_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT,
      last_modified TEXT NOT NULL DEFAULT (datetime('now')),
      is_dirty INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS terminal_history (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      output TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      is_remote INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ssh_connections (
      id TEXT PRIMARY KEY,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT NOT NULL,
      name TEXT,
      last_used TEXT
    );

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      code TEXT NOT NULL,
      language TEXT,
      tags TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Quest Mode tables
    CREATE TABLE IF NOT EXISTS quest_tasks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL DEFAULT 'New Quest',
      scenario TEXT NOT NULL DEFAULT 'spec',
      run_mode TEXT NOT NULL DEFAULT 'local',
      auto_mode TEXT NOT NULL DEFAULT 'auto',
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','running','paused','completed','failed')),
      spec_content TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      worktree_path TEXT
    );

    CREATE TABLE IF NOT EXISTS quest_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES quest_tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_quest_messages_task ON quest_messages(task_id);
    CREATE INDEX IF NOT EXISTS idx_quest_tasks_status ON quest_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_quest_tasks_updated ON quest_tasks(updated_at DESC);
  `);

  // Save initial schema
  database.save();

  // ─── Run migrations ───

  try {
    const { migration001 } = await import('./migrations/migration001_codepilot');
    database.run(migration001);
    console.log('[DB] Migration001 applied successfully');
    database.save();
  } catch (m1err) {
    console.warn('[DB] Migration001 skipped or failed:', m1err);
  }

  const migration002 = `
    CREATE TABLE IF NOT EXISTS context_blocks (
      id TEXT PRIMARY KEY,
      segment_id TEXT NOT NULL,
      content TEXT NOT NULL,
      role TEXT DEFAULT 'assistant',
      stored_at TEXT NOT NULL DEFAULT (datetime('now')),
      token_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS memory_anchors (
      id TEXT PRIMARY KEY,
      anchor_key TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      stored_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      category TEXT DEFAULT 'general',
      scope TEXT DEFAULT 'global',
      token_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tokens_short_term (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_context_blocks_segment ON context_blocks(segment_id);
    CREATE INDEX IF NOT EXISTS idx_memory_anchors_key ON memory_anchors(anchor_key);
    CREATE INDEX IF NOT EXISTS idx_memory_anchors_category ON memory_anchors(category);
    CREATE INDEX IF NOT EXISTS idx_memory_anchors_scope ON memory_anchors(scope);
    CREATE INDEX IF NOT EXISTS idx_tokens_session ON tokens_short_term(session_id);
  `;
  database.run(migration002);
  database.save();

  try {
    try {
      const { migration003 } = await import('./migrations/migration003_hermes_fusion');
      database.run(migration003);
      console.log('[DB] Migration003 (Hermes Fusion) applied successfully');
      database.save();
    } catch (m3err) {
      console.warn('[DB] Migration003 (Hermes Fusion) skipped or failed:', m3err);
    }

    try {
      const { migration005 } = await import('./migrations/migration005_github_skills');
      database.run(migration005);
      console.log('[DB] Migration005 (GitHub Skills) applied successfully');
      database.save();
    } catch (m5err) {
      console.warn('[DB] Migration005 (GitHub Skills) skipped or failed:', m5err);
    }
  } catch (schemaErr) {
    console.error('[DB] Database corrupted, recreating:', schemaErr);
    try {
      closeDatabase();
      const dbFilePath = getDatabasePath();
      if (require('fs').existsSync(dbFilePath)) {
        require('fs').unlinkSync(dbFilePath);
      }
      db = null;
      await initAdapter();
      database = getDatabase();
      database.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
          content TEXT,
          model TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          token_count INTEGER,
          truncated INTEGER DEFAULT 0,
          compacted_from_ids TEXT
        );

        CREATE TABLE IF NOT EXISTS code_edits (
          id TEXT PRIMARY KEY,
          file_path TEXT NOT NULL,
          original_content TEXT NOT NULL,
          new_content TEXT NOT NULL,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          accepted INTEGER DEFAULT 0,
          diff_summary TEXT
        );

        CREATE TABLE IF NOT EXISTS project_files (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          name TEXT NOT NULL,
          content TEXT,
          last_modified TEXT NOT NULL DEFAULT (datetime('now')),
          is_dirty INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS terminal_history (
          id TEXT PRIMARY KEY,
          command TEXT NOT NULL,
          output TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          is_remote INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS ssh_connections (
          id TEXT PRIMARY KEY,
          host TEXT NOT NULL,
          port INTEGER NOT NULL DEFAULT 22,
          username TEXT NOT NULL,
          name TEXT,
          last_used TEXT
        );

        CREATE TABLE IF NOT EXISTS snippets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          code TEXT NOT NULL,
          language TEXT,
          tags TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        -- Quest Mode tables
        CREATE TABLE IF NOT EXISTS quest_tasks (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL DEFAULT 1,
          title TEXT NOT NULL DEFAULT 'New Quest',
          scenario TEXT NOT NULL DEFAULT 'spec',
          run_mode TEXT NOT NULL DEFAULT 'local',
          auto_mode TEXT NOT NULL DEFAULT 'auto',
          status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','running','paused','completed','failed')),
          spec_content TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          worktree_path TEXT
        );

        CREATE TABLE IF NOT EXISTS quest_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT,
          tool_calls TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES quest_tasks(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_quest_messages_task ON quest_messages(task_id);
        CREATE INDEX IF NOT EXISTS idx_quest_tasks_status ON quest_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_quest_tasks_updated ON quest_tasks(updated_at DESC);
      `);
      database.save();
      console.log('[DB] Database recreated from scratch');
    } catch (recreateErr) {
      console.error('[DB] Fatal error recreating database:', recreateErr);
      throw recreateErr;
    }
  }
}
