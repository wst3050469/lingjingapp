import { idempotentAlterTable } from './idempotent-migration.js';

export const migration007_ddl = `
CREATE TABLE IF NOT EXISTS ai_design_results (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('schematic_generate', 'pcb_layout_suggest', 'drc_fix_suggest', 'component_select')),
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.0,
  confidence_label TEXT NOT NULL DEFAULT 'LOW' CHECK(confidence_label IN ('HIGH', 'MEDIUM', 'LOW')),
  applied INTEGER NOT NULL DEFAULT 0,
  drc_validated INTEGER DEFAULT NULL,
  session_id TEXT DEFAULT '',
  skill_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_design_results_type ON ai_design_results(type);
CREATE INDEX IF NOT EXISTS idx_ai_design_results_session ON ai_design_results(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_design_results_skill ON ai_design_results(skill_id);

CREATE TABLE IF NOT EXISTS hw_design_audit_log (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  action TEXT NOT NULL,
  params_summary TEXT DEFAULT '',
  result_status TEXT NOT NULL DEFAULT 'success' CHECK(result_status IN ('success', 'failure', 'timeout', 'cancelled')),
  duration_ms INTEGER DEFAULT 0,
  session_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hw_audit_skill ON hw_design_audit_log(skill_id);
CREATE INDEX IF NOT EXISTS idx_hw_audit_tool ON hw_design_audit_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_hw_audit_session ON hw_design_audit_log(session_id);

CREATE TABLE IF NOT EXISTS skill_publish_records (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version TEXT NOT NULL,
  checksum TEXT NOT NULL,
  security_scan_result TEXT DEFAULT '{}',
  publish_status TEXT NOT NULL DEFAULT 'pending' CHECK(publish_status IN ('pending', 'approved', 'rejected', 'published')),
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_publish_skill ON skill_publish_records(skill_id);
CREATE INDEX IF NOT EXISTS idx_publish_status ON skill_publish_records(publish_status);
CREATE INDEX IF NOT EXISTS idx_publish_version ON skill_publish_records(skill_id, version);
`;

export const migration007 = migration007_ddl;

export function applyMigration007(db: any): void {
  db.run(migration007_ddl);

  idempotentAlterTable(db, 'skill_installations', 'cli_dependencies', 'TEXT', "DEFAULT '[]'");
  idempotentAlterTable(db, 'skill_installations', 'file_associations', 'TEXT', "DEFAULT '[]'");
  idempotentAlterTable(db, 'skill_installations', 'tools_json', 'TEXT', "DEFAULT '{}'");
  idempotentAlterTable(db, 'skill_installations', 'skill_status', 'TEXT',
    "DEFAULT 'active' CHECK(skill_status IN ('active', 'dependency-missing', 'version-incompatible', 'disabled', 'uninstalled'))");
  idempotentAlterTable(db, 'skill_installations', 'sidebar_panels', 'TEXT', "DEFAULT '[]'");
}
