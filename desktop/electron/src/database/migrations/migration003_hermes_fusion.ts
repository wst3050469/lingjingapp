export const migration003 = `
CREATE TABLE IF NOT EXISTS vector_memory (
  id TEXT PRIMARY KEY,
  memory_id TEXT,
  content TEXT NOT NULL,
  embedding BLOB,
  metadata TEXT,
  scope TEXT,
  project_path TEXT,
  category TEXT,
  score REAL DEFAULT 0,
  encrypted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now'),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS execution_traces (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  tool_name TEXT,
  parameters TEXT,
  result TEXT,
  duration_ms INTEGER,
  importance REAL DEFAULT 0,
  created_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS skill_security_audit (
  id TEXT PRIMARY KEY,
  skill_path TEXT,
  skill_name TEXT,
  scan_result TEXT,
  risk_level TEXT,
  action_taken TEXT,
  scanner_ver TEXT,
  scanned_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS dag_tasks (
  id TEXT PRIMARY KEY,
  dag_def TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now'),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS dag_edges (
  id TEXT PRIMARY KEY,
  dag_id TEXT,
  node_id TEXT,
  status TEXT DEFAULT 'pending',
  result TEXT,
  started_at TEXT,
  completed_at TEXT,
  retry_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS model_routing_rules (
  id TEXT PRIMARY KEY,
  task_type TEXT,
  complexity TEXT,
  model TEXT NOT NULL,
  fallback_model TEXT,
  cost_budget REAL,
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS model_routing_audit (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  original_model TEXT,
  selected_model TEXT,
  matched_rule_id TEXT,
  reason TEXT,
  fallback INTEGER DEFAULT 0,
  created_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS cron_schedules (
  id TEXT PRIMARY KEY,
  cron_expression TEXT NOT NULL,
  natural_language TEXT,
  task_type TEXT,
  task_config TEXT,
  next_run_at TEXT,
  last_run_at TEXT,
  run_count INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  coding_style TEXT,
  tech_stack TEXT,
  workflow_patterns TEXT,
  model_preferences TEXT,
  decision_history TEXT,
  reflection_summary TEXT,
  last_reflected_at TEXT,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS fusion_config (
  module_name TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  config_json TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT datetime('now')
);

CREATE INDEX IF NOT EXISTS idx_vector_memory_scope ON vector_memory(scope);
CREATE INDEX IF NOT EXISTS idx_vector_memory_category ON vector_memory(category);
CREATE INDEX IF NOT EXISTS idx_vector_memory_project ON vector_memory(project_path);
CREATE INDEX IF NOT EXISTS idx_vector_memory_deleted ON vector_memory(deleted_at);
CREATE INDEX IF NOT EXISTS idx_execution_traces_session ON execution_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_traces_tool ON execution_traces(tool_name);
CREATE INDEX IF NOT EXISTS idx_skill_security_audit_path ON skill_security_audit(skill_path);
CREATE INDEX IF NOT EXISTS idx_dag_tasks_status ON dag_tasks(status);
CREATE INDEX IF NOT EXISTS idx_dag_edges_dag_id ON dag_edges(dag_id);
CREATE INDEX IF NOT EXISTS idx_dag_edges_status ON dag_edges(status);
CREATE INDEX IF NOT EXISTS idx_model_routing_rules_task ON model_routing_rules(task_type, complexity);
CREATE INDEX IF NOT EXISTS idx_model_routing_rules_enabled ON model_routing_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_model_routing_audit_request ON model_routing_audit(request_id);
CREATE INDEX IF NOT EXISTS idx_cron_schedules_enabled ON cron_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_cron_schedules_next_run ON cron_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);

INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('event_bus', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('hook_registry', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('vector_memory', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('execution_traces', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('skill_security', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('dag_engine', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('model_routing', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('cron_scheduler', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('user_profiler', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('review_gate', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('parallel_executor', 0, '{}');
INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('circuit_breaker', 0, '{}');
`;
