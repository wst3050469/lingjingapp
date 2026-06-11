export const migration002 = `
-- ── CI/CD Pipeline ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  yaml_path TEXT,
  definition TEXT NOT NULL,
  triggers TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  project_path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('manual','push','cron')),
  trigger_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','success','failed','cancelled','queued')),
  stages_result TEXT,
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  logs TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pipelines_project ON pipelines(project_path);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created ON pipeline_runs(created_at DESC);

-- ── Code Review ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_reports (
  id TEXT PRIMARY KEY,
  pr_id TEXT,
  branch TEXT,
  commit_sha TEXT,
  diff_content TEXT NOT NULL,
  findings TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  score REAL,
  dimensions TEXT,
  reviewed_at TEXT DEFAULT (datetime('now')),
  reviewer_type TEXT NOT NULL DEFAULT 'hybrid' CHECK(reviewer_type IN ('rule','llm','hybrid')),
  project_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dimension TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'regex' CHECK(pattern_type IN ('regex','ast')),
  message TEXT NOT NULL,
  suggestion TEXT,
  languages TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  builtin INTEGER NOT NULL DEFAULT 0,
  project_path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_review_reports_project ON review_reports(project_path);
CREATE INDEX IF NOT EXISTS idx_review_reports_branch ON review_reports(branch);
CREATE INDEX IF NOT EXISTS idx_review_reports_created ON review_reports(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_rules_dimension ON review_rules(dimension);
CREATE INDEX IF NOT EXISTS idx_review_rules_project ON review_rules(project_path);

-- ── Project Management ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('task','bug','feature','story','epic')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done','closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
  assignee TEXT,
  project_path TEXT NOT NULL,
  milestone_id TEXT,
  labels TEXT DEFAULT '[]',
  defect_severity TEXT CHECK(defect_severity IN ('blocker','critical','major','minor','trivial')),
  defect_category TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS work_item_commits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT,
  committed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS board_columns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  wip_limit INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  project_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','completed')),
  due_date TEXT,
  project_path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS status_change_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  changed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_items_type ON work_items(type);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_items_assignee ON work_items(assignee);
CREATE INDEX IF NOT EXISTS idx_work_items_project ON work_items(project_path);
CREATE INDEX IF NOT EXISTS idx_work_items_milestone ON work_items(milestone_id);
CREATE INDEX IF NOT EXISTS idx_work_item_commits_wi ON work_item_commits(work_item_id);
CREATE INDEX IF NOT EXISTS idx_board_columns_project ON board_columns(project_path);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_path);
CREATE INDEX IF NOT EXISTS idx_status_change_wi ON status_change_logs(work_item_id);

-- ── Security Scan ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_results (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('full','incremental','specified')),
  target_files TEXT,
  vulnerabilities TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  total_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  project_path TEXT NOT NULL,
  scanned_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS security_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vulnerability_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'regex' CHECK(pattern_type IN ('regex','ast')),
  severity TEXT NOT NULL DEFAULT 'high',
  languages TEXT NOT NULL DEFAULT '[]',
  message TEXT NOT NULL,
  suggestion TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  builtin INTEGER NOT NULL DEFAULT 0,
  project_path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_results_project ON scan_results(project_path);
CREATE INDEX IF NOT EXISTS idx_scan_results_scanned ON scan_results(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_rules_vuln_type ON security_rules(vulnerability_type);
CREATE INDEX IF NOT EXISTS idx_security_rules_project ON security_rules(project_path);
`;
