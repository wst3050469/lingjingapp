-- 005_auto_fetch.sql
-- Auto-fetch: add last_synced_at column for change detection

ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
