// SQLite database layer using sql.js (pure JS, no native compilation)

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

// ── Mutex to prevent concurrent writes from corrupting the database ──
let saveLock: Promise<void> = Promise.resolve();

function getDbPath(): string {
  return join(homedir(), '.lingjing', 'lingjing.db');
}

/**
 * Locate the sql-wasm.wasm file.
 * In packaged Electron apps, the wasm is in app.asar.unpacked/
 * because asar archives can't serve wasm files directly.
 */
async function loadWasmBinary(): Promise<ArrayBuffer> {
  const candidates: string[] = [];

  // Method 0: Direct extraResources path (most reliable for packaged Electron)
  if (typeof process !== 'undefined' && (process as any).resourcesPath) {
    candidates.push(
      join((process as any).resourcesPath, 'sql-wasm.wasm'),
    );
  }

  // Method 1: Use process.resourcesPath with app.asar.unpacked
  if (typeof process !== 'undefined' && (process as any).resourcesPath) {
    candidates.push(
      join((process as any).resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      join((process as any).resourcesPath, 'app', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    );
  }

  // Method 2: Use createRequire to resolve from module context
  try {
    // In CJS builds (esbuild format:'cjs'), import.meta.url is undefined.
    // createRequire needs a valid path, so skip if import.meta.url is unavailable.
    if (import.meta.url) {
      const require = createRequire(import.meta.url);
      const resolved = require.resolve('sql.js/package.json');
      const base = join(dirname(resolved), 'dist', 'sql-wasm.wasm');
      const unpacked = base.replace('app.asar', 'app.asar.unpacked');
      candidates.push(unpacked, base);
    }
  } catch {
    // require.resolve may fail in some contexts
  }

  // Method 3: Relative to current file (__dirname equivalent for ESM)
  // In CJS builds (esbuild format:'cjs'), import.meta.url is undefined.
  // Fall back to __dirname which IS available in CJS.
  let currentDir: string;
  try {
    currentDir = import.meta.url
      ? dirname(fileURLToPath(import.meta.url))
      : (typeof __dirname !== 'undefined' ? __dirname : process.cwd());
  } catch {
    currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }
  candidates.push(
    join(currentDir, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    // Also check the electron package root (where sql-wasm.wasm is shipped)
    join(currentDir, '..', 'sql-wasm.wasm'),
  );

  // Method 4: pnpm node_modules structure (from project root)
  if (typeof process !== 'undefined' && process.cwd()) {
    const projectRoot = process.cwd();
    candidates.push(
      join(projectRoot, 'node_modules', '.pnpm', 'sql.js@1.14.1', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      join(projectRoot, 'packages', 'electron', 'node_modules', '.pnpm', 'sql.js@1.14.1', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    );
  }

  // Method 5: Search up from current file for pnpm structure
  let searchDir = currentDir;
  for (let i = 0; i < 10; i++) {
    const pnpmPath = join(searchDir, 'node_modules', '.pnpm', 'sql.js@1.14.1', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    candidates.push(pnpmPath);
    const parent = dirname(searchDir);
    if (parent === searchDir) break; // Reached root
    searchDir = parent;
  }

  console.log('[DB] Searching for sql-wasm.wasm in:', candidates);
  for (const p of candidates) {
    const exists = existsSync(p);
    console.log('[DB] Checking:', p, '- exists:', exists);
    if (exists) {
      console.log('[DB] Found sql-wasm.wasm at:', p);
      const buf = await readFile(p);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
  }

  throw new Error(`sql-wasm.wasm not found. Searched:\n${candidates.join('\n')}`);
}

export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  dbPath = getDbPath();
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    await mkdir(dbDir, { recursive: true });
  }

  const wasmBinary = await loadWasmBinary();
  const SQL = await initSqlJs({ wasmBinary });

  // Load existing database or create new one
  if (existsSync(dbPath)) {
    try {
      const fileBuffer = await readFile(dbPath);
      db = new SQL.Database(new Uint8Array(fileBuffer));
    } catch (err) {
      console.error('[DB] Failed to load existing database, creating new one:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Create tables — wrapped in try/catch to handle corrupted databases
  try {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool', 'system')),
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL DEFAULT 'global' CHECK(scope IN ('global', 'project')),
      project_path TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'active' CHECK(source IN ('active', 'automatic')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Indexes for memory queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_memories_scope_project ON memories(scope, project_path);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);`);

  // Embedding vector storage for codebase_search
  db.run(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace TEXT NOT NULL,
      file_path TEXT NOT NULL,
      chunk_start INTEGER NOT NULL,
      chunk_end INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding BLOB NOT NULL,
      file_mtime TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS file_index_meta (
      workspace TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mtime TEXT NOT NULL,
      chunk_count INTEGER NOT NULL,
      PRIMARY KEY (workspace, file_path)
    );
  `);

  // Quest Mode tables
  db.run(`
    CREATE TABLE IF NOT EXISTS quest_tasks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      scenario TEXT NOT NULL DEFAULT 'spec',
      run_mode TEXT NOT NULL DEFAULT 'local',
      auto_mode TEXT NOT NULL DEFAULT 'auto',
      status TEXT NOT NULL DEFAULT 'idle',
      spec_content TEXT,
      worktree_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quest_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES quest_tasks(id)
    );
  `);

  // Planning Agent tables
  db.run(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      goals TEXT NOT NULL,
      constraints TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'reviewing', 'approved', 'executing', 'paused', 'completed', 'cancelled')),
      current_step_index INTEGER NOT NULL DEFAULT 0,
      working_directory TEXT NOT NULL,
      retrospective TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plan_steps (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      files TEXT,
      commands TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
      estimated_complexity TEXT CHECK(estimated_complexity IN ('low', 'medium', 'high')),
      result TEXT,
      error TEXT,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_plans_working_dir ON plans(working_directory);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_plan_steps_plan_id ON plan_steps(plan_id);`);

  // Create default development user if no users exist
  const userCount = db.exec(`SELECT COUNT(*) FROM users`);
  const hasUsers = userCount.length > 0 && userCount[0].values.length > 0 && (userCount[0].values[0][0] as number) > 0;
  
  if (!hasUsers) {
    console.log('[DB] No users found, creating default development user: admin/admin123');
    // Pre-hashed password for 'admin123' using bcrypt with cost factor 12
    const defaultPasswordHash = '$2b$12$OaEYAEJsBqEDI7CfRqO3A.HjIMi0hZtup.ubdq0ScFWVEcFg2U.Oi';
    
    db.run(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      ['admin', 'admin@localhost', defaultPasswordHash],
    );
    console.log('[DB] Default user created successfully');
  }

  // Import and initialize cloud sync tables
  const { initSyncTables } = await import('./sync-tables');
  await initSyncTables();

  // Run checkpoint migrations
  const { migration001 } = await import('./migrations/001-checkpoint-tables');
  db.run(migration001);

  // Run platform module migrations (pipeline/review/pm/security)
  const { migration002 } = await import('./migrations/002-platform-tables');
  db.run(migration002);

  } catch (schemaErr) {
    // Database file is corrupted — recreate from scratch
    console.error('[DB] Database corrupted, recreating:', schemaErr);
    try { db.close(); } catch { /* ignore */ }
    db = null;
    // Backup corrupted file
    const backupPath = dbPath + '.corrupted.' + Date.now();
    try { renameSync(dbPath, backupPath); } catch { /* ignore */ }
    console.log('[DB] Corrupted database backed up to:', backupPath);
    // Retry — initDatabase will create a fresh DB since db is null and file is gone
    return initDatabase();
  }

  // Persist to disk
  await saveDatabase();

  return db;
}

// ────────────────────────────────────────────────────────────────────────────
// saveDatabase — ATOMIC write with concurrency protection
//
// Writes to a .tmp file first, then atomically renames to the target path.
// This guarantees the on-disk file is either the complete old version or the
// complete new version — never a truncated partial write.
//
// Uses a mutex (saveLock) to serialize concurrent writes from multiple IPC
// modules. Without this, module A could db.export() a snapshot, then module B
// writes more data, then A's stale snapshot overwrites B's changes.
// ────────────────────────────────────────────────────────────────────────────
export async function saveDatabase(): Promise<void> {
  if (!db) return;

  // Chain onto the existing lock so concurrent callers serialize
  saveLock = saveLock.then(async () => {
    if (!db) return;

    try {
      // 1. Export the in-memory database snapshot
      const data = db.export();
      const buffer = Buffer.from(data);

      // 2. Write to a temporary file first
      const tmpPath = dbPath + '.tmp';
      await writeFile(tmpPath, buffer);

      // 3. Atomically rename tmp → real path
      //    On Windows, renameSync replaces the target if it exists
      renameSync(tmpPath, dbPath);
    } catch (err) {
      console.error('[DB] Failed to save database:', err);
      // Clean up stale tmp file if it exists
      try { unlinkSync(dbPath + '.tmp'); } catch { /* ignore */ }
      throw err;
    }
  });

  // Wait for our turn in the lock chain
  await saveLock;
}

export function getDatabase(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

/**
 * Synchronous save for crash/exit handlers where async is not possible.
 * Not mutex-protected — caller must ensure no concurrent writes.
 */
export function saveDatabaseSync(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const tmpPath = dbPath + '.tmp';
    writeFileSync(tmpPath, buffer);
    renameSync(tmpPath, dbPath);
  } catch (err) {
    console.error('[DB] Failed to save database synchronously:', err);
    try { unlinkSync(dbPath + '.tmp'); } catch { /* ignore */ }
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await saveDatabase();
    db.close();
    db = null;
  }
}
