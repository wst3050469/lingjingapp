export const migration008 = `
-- Skill Reviews: user ratings & reviews for marketplace skills
CREATE TABLE IF NOT EXISTS skill_reviews (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'local',
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title TEXT DEFAULT '',
  review TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(skill_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_reviews_skill ON skill_reviews(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_reviews_rating ON skill_reviews(rating);

-- Skill Usage Stats: track installation/usage metrics
CREATE TABLE IF NOT EXISTS skill_usage_stats (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('install', 'uninstall', 'execute', 'view', 'share')),
  user_id TEXT NOT NULL DEFAULT 'local',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skill_usage_stats_skill ON skill_usage_stats(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_usage_stats_metric ON skill_usage_stats(metric);
CREATE INDEX IF NOT EXISTS idx_skill_usage_stats_date ON skill_usage_stats(created_at);

-- Push Notification Log: track delivery status
CREATE TABLE IF NOT EXISTS push_notification_log (
  id TEXT PRIMARY KEY,
  session_id TEXT DEFAULT '',
  device_id TEXT DEFAULT '',
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  channel TEXT NOT NULL DEFAULT 'ws' CHECK(channel IN ('ws', 'fcm', 'apns', 'slack', 'discord')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_log_status ON push_notification_log(delivery_status);
CREATE INDEX IF NOT EXISTS idx_push_log_date ON push_notification_log(created_at);
`;
