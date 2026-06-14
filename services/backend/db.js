/**
 * 灵境 Cloud Database
 * SQLite — zero config, file-based persistence
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function initDB(dbPath) {
  const path = dbPath || join(__dirname, 'data', 'lingjing.db');
  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT '',
      title TEXT DEFAULT '',
      messages TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created_at TEXT,
      updated_at TEXT
    )
  `);

  try { db.exec('ALTER TABLE sessions ADD COLUMN user_id TEXT DEFAULT ""'); } catch (e) { /* column already exists */ }
  try { db.exec("ALTER TABLE devices ADD COLUMN status TEXT DEFAULT 'offline'"); } catch (e) { /* column already exists */ }

  // Admin audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      method TEXT DEFAULT '',
      path TEXT DEFAULT '',
      status_code INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user)');

  // Memories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      category TEXT DEFAULT 'general',
      scope TEXT DEFAULT 'project',
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // Webhook logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      channel TEXT,
      payload TEXT,
      received_at TEXT
    )
  `);

  // Tools registry
  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      description TEXT,
      schema TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT
    )
  `);

  // Conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      messages TEXT DEFAULT '[]',
      updated_at TEXT
    )
  `);

  // Devices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT,
      device_info TEXT DEFAULT '{}',
      token TEXT UNIQUE,
      status TEXT DEFAULT 'offline',
      last_seen TEXT,
      created_at TEXT
    )
  `);

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      avatar TEXT,
      password_strength TEXT DEFAULT 'medium',
      two_factor_enabled INTEGER DEFAULT 0,
      two_factor_method TEXT,
      two_factor_secret TEXT,
      session_timeout INTEGER DEFAULT 60,
      login_notification INTEGER DEFAULT 1,
      registered_at TEXT,
      last_login_at TEXT
    )
  `);

  // Login history
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT,
      ip_address TEXT,
      location TEXT,
      device TEXT,
      success INTEGER,
      failure_reason TEXT
    )
  `);

  // User devices
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      type TEXT,
      os TEXT,
      last_sync_at TEXT,
      sync_status TEXT DEFAULT 'synced',
      is_online INTEGER DEFAULT 0,
      authorization_status TEXT DEFAULT 'authorized',
      bound_at TEXT,
      is_current_device INTEGER DEFAULT 0
    )
  `);

  // Authorization codes
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      device_id TEXT,
      created_at TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'pending'
    )
  `);

  // Subscriptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      plan_name TEXT,
      status TEXT DEFAULT 'active',
      started_at TEXT,
      expires_at TEXT,
      auto_renew INTEGER DEFAULT 1
    )
  `);

  // Plans
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT,
      price REAL,
      billing_cycle TEXT,
      features TEXT DEFAULT '[]',
      limits TEXT DEFAULT '{}',
      recommended INTEGER DEFAULT 0
    )
  `);

  // Sync records
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT,
      data_type TEXT,
      operation TEXT,
      status TEXT,
      size INTEGER,
      device_id TEXT
    )
  `);

  // Sync conflicts
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data_type TEXT,
      local_value TEXT,
      remote_value TEXT,
      local_timestamp TEXT,
      remote_timestamp TEXT,
      resolution TEXT
    )
  `);

  // Storage files
  db.exec(`
    CREATE TABLE IF NOT EXISTS storage_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      path TEXT,
      size INTEGER,
      type TEXT,
      category TEXT,
      created_at TEXT,
      modified_at TEXT
    )
  `);

  // API keys
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      key TEXT UNIQUE,
      permissions TEXT DEFAULT '[]',
      created_at TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'active',
      last_used_at TEXT,
      call_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0
    )
  `);

  // Schedules
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT,
      cron_expr TEXT,
      action_type TEXT DEFAULT 'http',
      action_config TEXT DEFAULT '{}',
      max_retries INTEGER DEFAULT 3,
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT,
      last_error TEXT
    )
  `);

  // ===== New tables for v1.64.x =====

  // Payments
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT,
      device_id TEXT DEFAULT '',
      amount REAL,
      currency TEXT DEFAULT 'CNY',
      payment_method TEXT,
      payment_status TEXT DEFAULT 'pending',
      transaction_id TEXT,
      invoice_number TEXT,
      paid_at TEXT,
      created_at TEXT
    )
  `);

  // Offline payments
  db.exec(`
    CREATE TABLE IF NOT EXISTS offline_payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL,
      company_name TEXT,
      bank_name TEXT DEFAULT '',
      bank_account TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      receipt_url TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TEXT
    )
  `);

  // Invoices
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payment_id TEXT,
      amount REAL,
      title TEXT,
      tax_id TEXT,
      email TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    )
  `);

  // Defects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS defects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      severity TEXT CHECK(severity IN ('P0','P1','P2','P3')) DEFAULT 'P2',
      module TEXT,
      description TEXT,
      status TEXT CHECK(status IN ('open','fixing','fixed','verified','closed')) DEFAULT 'open',
      fix_description TEXT,
      reporter_id TEXT,
      assignee_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      closed_at TEXT
    )
  `);

  // Push notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_notifications (
      id TEXT PRIMARY KEY,
      type TEXT,
      title TEXT,
      body TEXT,
      device_id TEXT,
      user_id TEXT,
      delivery_status TEXT CHECK(delivery_status IN ('pending','sent','failed')) DEFAULT 'pending',
      channel TEXT CHECK(channel IN ('apns','fcm','websocket')) DEFAULT 'websocket',
      error_message TEXT,
      sent_at TEXT,
      created_at TEXT
    )
  `);

  // System config table
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      updated_by TEXT,
      updated_at TEXT
    )
  `);

  // Config audit log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS config_audit_log (
      id TEXT PRIMARY KEY,
      config_key TEXT,
      old_value TEXT,
      new_value TEXT,
      operator TEXT,
      operated_at TEXT
    )
  `);

  // Skills table (referenced by admin-api but missing)
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT DEFAULT 'general',
      description TEXT,
      version TEXT DEFAULT '1.0.0',
      author TEXT,
      status TEXT DEFAULT 'pending',
      security_status TEXT DEFAULT 'unverified',
      rating REAL DEFAULT 0,
      install_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // ===== Version Review System (v1.71+) =====

  // Versions table — replaces versions.json for review workflow
  db.exec(`
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','pending_review','approved','rejected')),
      changelog TEXT DEFAULT '',
      download_url TEXT DEFAULT '',
      files TEXT DEFAULT '{}',
      submitter_id TEXT DEFAULT '',
      submitter_name TEXT DEFAULT '',
      submitted_at TEXT,
      reviewer_id TEXT DEFAULT '',
      reviewer_name TEXT DEFAULT '',
      reviewed_at TEXT,
      reject_reason TEXT DEFAULT '',
      locked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Version reviews audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS version_reviews (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL,
      action TEXT NOT NULL
        CHECK(action IN ('submit','approve','reject')),
      reviewer_id TEXT NOT NULL,
      reviewer_name TEXT DEFAULT '',
      comment TEXT DEFAULT '',
      old_status TEXT,
      new_status TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (version_id) REFERENCES versions(id)
    )
  `);

  // Seed default plans if empty
  const planCount = db.prepare('SELECT COUNT(*) as cnt FROM plans').get();
  if (planCount.cnt === 0) {
    const insertPlan = db.prepare('INSERT INTO plans (id, name, price, billing_cycle, features, limits, recommended) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertPlan.run('free', '免费版', 0, 'monthly', JSON.stringify([
      { name: 'basic_chat', desc: '基础对话', included: true },
      { name: 'basic_quest', desc: '基础任务', included: true },
      { name: 'api_calls_100', desc: '100次/月 API调用', included: true },
      { name: 'memories_10', desc: '10条记忆体', included: true },
      { name: 'sessions_5', desc: '5个活跃会话', included: true },
      { name: 'advanced_models', desc: '高级模型访问', included: false },
      { name: 'priority_support', desc: '优先技术支持', included: false }
    ]), JSON.stringify({ apiCalls: 100, sessions: 5, memories: 10, storageFiles: 50, apiKeys: 1 }), 0);
    insertPlan.run('personal', '个人版', 29, 'monthly', JSON.stringify([
      { name: 'unlimited_chat', desc: '无限对话', included: true },
      { name: 'unlimited_quest', desc: '无限任务', included: true },
      { name: 'api_calls_1000', desc: '1000次/月 API调用', included: true },
      { name: 'memories_100', desc: '100条记忆体', included: true },
      { name: 'sessions_50', desc: '50个活跃会话', included: true },
      { name: 'advanced_models', desc: '高级模型访问', included: true },
      { name: 'priority_support', desc: '优先技术支持', included: false }
    ]), JSON.stringify({ apiCalls: 1000, sessions: 50, memories: 100, storageFiles: 500, apiKeys: 5 }), 1);
    insertPlan.run('pro', '专业版', 99, 'monthly', JSON.stringify([
      { name: 'unlimited_chat', desc: '无限对话', included: true },
      { name: 'unlimited_quest', desc: '无限任务', included: true },
      { name: 'api_calls_10000', desc: '10000次/月 API调用', included: true },
      { name: 'memories_1000', desc: '1000条记忆体', included: true },
      { name: 'sessions_unlimited', desc: '无限活跃会话', included: true },
      { name: 'advanced_models', desc: '高级模型访问', included: true },
      { name: 'priority_support', desc: '优先技术支持', included: true }
    ]), JSON.stringify({ apiCalls: 10000, sessions: 99999, memories: 1000, storageFiles: 5000, apiKeys: 50 }), 0);
    console.log('[DB] Seeded default plans (free/personal/pro)');
  }

  // Performance indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at)',
    'CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)',
    'CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at)',
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)',
    'CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status)',
    'CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at ON webhook_logs(received_at)',
    'CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen)',
    'CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_devices_is_online ON user_devices(is_online)',
  ];
  for (const sql of indexes) {
    try { db.exec(sql); } catch (e) { /* index may already exist */ }
  }

  return db;
}

export function closeDB(db) {
  if (db) db.close();
}
