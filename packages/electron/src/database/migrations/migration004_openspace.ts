export const migration004 = `
CREATE TABLE IF NOT EXISTS openspace_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS openspace_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  started_at TEXT,
  stopped_at TEXT,
  state TEXT,
  config_json TEXT,
  frame_count INTEGER DEFAULT 0,
  output_path TEXT,
  description TEXT,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS openspace_scripts (
  id TEXT PRIMARY KEY,
  correlation_id TEXT,
  script TEXT NOT NULL,
  language TEXT,
  source TEXT,
  result TEXT,
  error TEXT,
  duration_ms INTEGER,
  risk_level TEXT,
  security_passed INTEGER DEFAULT 1,
  executed_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS openspace_profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  modules_json TEXT,
  dataset_paths_json TEXT,
  camera_json TEXT,
  rendering_json TEXT,
  file_path TEXT,
  template_name TEXT,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS openspace_sync_profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  server_address TEXT,
  port INTEGER,
  password TEXT,
  default_role TEXT,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE INDEX IF NOT EXISTS idx_openspace_sessions_state ON openspace_sessions(state);
CREATE INDEX IF NOT EXISTS idx_openspace_sessions_profile ON openspace_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_openspace_scripts_correlation ON openspace_scripts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_openspace_scripts_language ON openspace_scripts(language);
CREATE INDEX IF NOT EXISTS idx_openspace_scripts_executed ON openspace_scripts(executed_at);
CREATE INDEX IF NOT EXISTS idx_openspace_profiles_name ON openspace_profiles(name);

INSERT OR IGNORE INTO openspace_config (key, value, updated_at) VALUES ('install_path', '', datetime('now'));
INSERT OR IGNORE INTO openspace_config (key, value, updated_at) VALUES ('websocket_port', '4680', datetime('now'));
INSERT OR IGNORE INTO openspace_config (key, value, updated_at) VALUES ('command_timeout', '30000', datetime('now'));
INSERT OR IGNORE INTO openspace_config (key, value, updated_at) VALUES ('health_check_interval', '5000', datetime('now'));
INSERT OR IGNORE INTO openspace_config (key, value, updated_at) VALUES ('max_reconnect_attempts', '5', datetime('now'));
INSERT OR IGNORE INTO openspace_config (key, value, updated_at) VALUES ('reconnect_interval', '3000', datetime('now'));
INSERT OR IGNORE INTO openspace_config (key, value, updated_at) VALUES ('preferred_transport', 'websocket', datetime('now'));
INSERT OR IGNORE INTO openspace_config (key, value, updated_at) VALUES ('min_compatible_version', '0.19.0', datetime('now'));

INSERT OR IGNORE INTO fusion_config (module_name, enabled, config_json) VALUES ('openspace', 0, '{}');
`;
