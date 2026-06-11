export const migration003 = `
-- ── Hermes Fusion: Event Bus ──────────────────────────────
CREATE TABLE IF NOT EXISTS fusion_events (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  source TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fusion_events_channel ON fusion_events(channel);
CREATE INDEX IF NOT EXISTS idx_fusion_events_timestamp ON fusion_events(timestamp DESC);

-- ── Hermes Fusion: Hook Registry ──────────────────────────
CREATE TABLE IF NOT EXISTS fusion_hooks (
  id TEXT PRIMARY KEY,
  point TEXT NOT NULL,
  handler_name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fusion_hooks_point ON fusion_hooks(point);

-- ── Hermes Fusion: Module Registry ────────────────────────
CREATE TABLE IF NOT EXISTS fusion_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','degraded','disabled','error')),
  config TEXT DEFAULT '{}',
  last_health_check TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── Hermes Fusion: Review Engine ──────────────────────────
CREATE TABLE IF NOT EXISTS fusion_review_sessions (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  findings TEXT NOT NULL DEFAULT '[]',
  score REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Hermes Fusion: NL Cron Scheduled Jobs ─────────────────
CREATE TABLE IF NOT EXISTS fusion_cron_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  action TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Hermes Fusion: Execution Traces ───────────────────────
CREATE TABLE IF NOT EXISTS fusion_traces (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT,
  tool_name TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ok' CHECK(status IN ('ok','error','timeout')),
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fusion_traces_session ON fusion_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_fusion_traces_created ON fusion_traces(created_at DESC);

-- ── Hermes Fusion: Vector Memory ──────────────────────────
CREATE TABLE IF NOT EXISTS fusion_vectors (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global',
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fusion_vectors_scope ON fusion_vectors(scope);
CREATE INDEX IF NOT EXISTS idx_fusion_vectors_category ON fusion_vectors(category);
`;
