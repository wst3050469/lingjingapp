import { idempotentAlterTable } from './idempotent-migration.js';

export const migration006_ddl = `
CREATE TABLE IF NOT EXISTS bug_records (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  module TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'fixing', 'fixed', 'verified', 'wontfix')),
  fix_description TEXT DEFAULT '',
  affected_files TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bug_records_severity ON bug_records(severity);
CREATE INDEX IF NOT EXISTS idx_bug_records_module ON bug_records(module);
CREATE INDEX IF NOT EXISTS idx_bug_records_status ON bug_records(status);

CREATE TABLE IF NOT EXISTS skill_installations (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  installed_version TEXT NOT NULL DEFAULT '1.0.0',
  install_path TEXT NOT NULL,
  security_scan_result TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'uninstalled', 'scan_failed')),
  installed_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skill_installations_skill_id ON skill_installations(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_installations_user_id ON skill_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_installations_status ON skill_installations(status);

CREATE TABLE IF NOT EXISTS push_notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('approval', 'question', 'instruction_wait', 'task_complete', 'task_failed')),
  session_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
  retry_count INTEGER DEFAULT 0,
  payload TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_notifications_status ON push_notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_push_notifications_session ON push_notifications(session_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_device ON push_notifications(device_id);

CREATE TABLE IF NOT EXISTS skill_meta (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom' CHECK(category IN ('code_generation', 'testing', 'review', 'deployment', 'custom')),
  author TEXT DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  icon_url TEXT DEFAULT '',
  rating REAL DEFAULT 0.0,
  install_count INTEGER DEFAULT 0,
  security_status TEXT NOT NULL DEFAULT 'pending' CHECK(security_status IN ('pending', 'approved', 'rejected', 'scanning')),
  dependencies TEXT DEFAULT '[]',
  entry_point TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skill_meta_category ON skill_meta(category);
CREATE INDEX IF NOT EXISTS idx_skill_meta_rating ON skill_meta(rating DESC);
CREATE INDEX IF NOT EXISTS idx_skill_meta_installs ON skill_meta(install_count DESC);
CREATE INDEX IF NOT EXISTS idx_skill_meta_security ON skill_meta(security_status);

CREATE TABLE IF NOT EXISTS device_registrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK(device_type IN ('ios', 'android')),
  device_name TEXT DEFAULT '',
  push_token TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  app_version TEXT DEFAULT '',
  last_connected_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_device_registrations_user ON device_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_device_registrations_token ON device_registrations(push_token);
CREATE INDEX IF NOT EXISTS idx_device_registrations_active ON device_registrations(is_active);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_lru ON agent_sessions(status, last_activity_at);
`;

export const migration006 = migration006_ddl;

export function applyMigration006(db: any): void {
  db.run(migration006_ddl);

  idempotentAlterTable(db, 'agent_sessions', 'provider_id', 'TEXT', "DEFAULT ''");
  idempotentAlterTable(db, 'agent_sessions', 'workspace_path', 'TEXT', "DEFAULT ''");
  idempotentAlterTable(db, 'agent_sessions', 'tool_registry_snapshot', 'TEXT', "DEFAULT '{}'");
  idempotentAlterTable(db, 'agent_sessions', 'last_activity_at', 'INTEGER', 'DEFAULT 0');
}
