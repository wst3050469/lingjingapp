export const migration001 = `
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  description TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  total_size INTEGER NOT NULL,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS checkpoint_files (
  checkpoint_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  hash TEXT NOT NULL,
  size INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (checkpoint_id, file_path),
  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_operation_logs (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  target_files TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_confirmed INTEGER NOT NULL DEFAULT 0,
  result_summary TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp ON checkpoints(timestamp);
CREATE INDEX IF NOT EXISTS idx_checkpoint_files_path ON checkpoint_files(file_path);
CREATE INDEX IF NOT EXISTS idx_ai_ops_type ON ai_operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_ops_timestamp ON ai_operation_logs(timestamp);
`;
