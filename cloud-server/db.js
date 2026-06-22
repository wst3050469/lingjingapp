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

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '',
      messages TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created_at TEXT,
      updated_at TEXT
    )
  `);

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
      content TEXT DEFAULT '',
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
      updated_at TEXT
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

  // Requirements (需求 + 审批)
  db.exec(`
    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      assignee TEXT DEFAULT '',
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      reviewer_comment TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_at TEXT,
      updated_at TEXT
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

  return db;
}

export function closeDB(db) {
  if (db) db.close();
}
