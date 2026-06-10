/**
 * Migration 004: OpenSpace Fusion Tables
 *
 * Creates tables for managing OpenSpace 3D visualization process integration:
 * - openspace_processes: track OpenSpace instances
 * - openspace_scripts: manage Lua scripts for OpenSpace
 * - openspace_profiles: save/restore OpenSpace configurations
 * - openspace_recordings: manage session recordings
 * - openspace_sync_state: global synchronization state
 */

export const migration004 = `
CREATE TABLE IF NOT EXISTS openspace_processes (
  id TEXT PRIMARY KEY,
  profile_name TEXT NOT NULL,
  run_state TEXT DEFAULT 'stopped',
  pid INTEGER,
  workspace_path TEXT,
  scene_context TEXT,
  health_status TEXT DEFAULT 'unknown',
  last_health_check TEXT,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS openspace_scripts (
  id TEXT PRIMARY KEY,
  process_id TEXT,
  language TEXT DEFAULT 'lua',
  script_path TEXT,
  script_content TEXT,
  security_risk_level TEXT DEFAULT 'unknown',
  last_review_at TEXT,
  created_at TEXT DEFAULT datetime('now'),
  FOREIGN KEY (process_id) REFERENCES openspace_processes(id)
);

CREATE TABLE IF NOT EXISTS openspace_profiles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  installation_path TEXT,
  version TEXT,
  display_mode TEXT DEFAULT 'windowed',
  camera_position TEXT,
  window_state TEXT,
  dataset_path TEXT,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS openspace_recordings (
  id TEXT PRIMARY KEY,
  process_id TEXT,
  name TEXT NOT NULL,
  state TEXT DEFAULT 'idle',
  duration_ms INTEGER DEFAULT 0,
  frame_count INTEGER DEFAULT 0,
  file_path TEXT,
  started_at TEXT,
  stopped_at TEXT,
  created_at TEXT DEFAULT datetime('now'),
  FOREIGN KEY (process_id) REFERENCES openspace_processes(id)
);

CREATE TABLE IF NOT EXISTS openspace_sync_state (
  id TEXT PRIMARY KEY,
  role TEXT DEFAULT 'none',
  connection_config TEXT,
  state TEXT DEFAULT 'disconnected',
  last_sync_at TEXT,
  created_at TEXT DEFAULT datetime('now'),
  updated_at TEXT DEFAULT datetime('now')
);

CREATE INDEX IF NOT EXISTS idx_openspace_processes_state ON openspace_processes(run_state);
CREATE INDEX IF NOT EXISTS idx_openspace_scripts_process ON openspace_scripts(process_id);
CREATE INDEX IF NOT EXISTS idx_openspace_scripts_risk ON openspace_scripts(security_risk_level);
CREATE INDEX IF NOT EXISTS idx_openspace_profiles_name ON openspace_profiles(name);
CREATE INDEX IF NOT EXISTS idx_openspace_recordings_process ON openspace_recordings(process_id);
CREATE INDEX IF NOT EXISTS idx_openspace_recordings_state ON openspace_recordings(state);
CREATE INDEX IF NOT EXISTS idx_openspace_sync_role ON openspace_sync_state(role);
`;
