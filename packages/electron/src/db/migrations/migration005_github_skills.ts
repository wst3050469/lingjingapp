export const migration005 = `
CREATE TABLE IF NOT EXISTS installed_skills (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'github',
  repo_url TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  description TEXT DEFAULT '',
  version TEXT DEFAULT 'latest',
  language TEXT DEFAULT '',
  stars INTEGER DEFAULT 0,
  skill_type TEXT NOT NULL DEFAULT 'tool',
  tool_name TEXT NOT NULL,
  tool_description TEXT DEFAULT '',
  tool_parameters TEXT DEFAULT '{}',
  execute_command TEXT DEFAULT '',
  install_path TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  installed_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_installed_skills_source ON installed_skills(source);
CREATE INDEX IF NOT NULL idx_installed_skills_status ON installed_skills(status);
CREATE INDEX IF NOT EXISTS idx_installed_skills_tool_name ON installed_skills(tool_name);
CREATE INDEX IF NOT EXISTS idx_installed_skills_repo_name ON installed_skills(repo_name);
`;
