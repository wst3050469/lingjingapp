-- 010_fix_samples.sql
-- 补齐 sample_records 表缺失的字段（创建样品 API 需要的列）
-- 执行方式: psql -d lingjing -f 010_fix_samples.sql

ALTER TABLE sample_records ADD COLUMN IF NOT EXISTS project_name VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE sample_records ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE sample_records ADD COLUMN IF NOT EXISTS file_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sample_records ADD COLUMN IF NOT EXISTS phase VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE sample_records ADD COLUMN IF NOT EXISTS specification TEXT NOT NULL DEFAULT '';
ALTER TABLE sample_records ADD COLUMN IF NOT EXISTS formula TEXT NOT NULL DEFAULT '';
