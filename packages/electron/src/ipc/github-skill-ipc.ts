import { ipcMain } from 'electron';
import https from 'https';

interface GitHubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  default_branch: string;
  topics: string[];
  license: { spdx_id: string } | null;
}

interface InstalledSkill {
  id: string;
  source: string;
  repo_url: string;
  repo_name: string;
  repo_owner: string;
  description: string;
  version: string;
  language: string;
  stars: number;
  skill_type: string;
  tool_name: string;
  tool_description: string;
  tool_parameters: string;
  execute_command: string;
  install_path: string;
  status: string;
  installed_at: string;
  updated_at: string;
}

let dbRef: any = null;

export function setGithubSkillDb(db: any): void {
  dbRef = db;
}

function githubApiRequest(path: string, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'User-Agent': 'LingJing-IDE',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const req = https.request(
      { hostname: 'api.github.com', path, method: 'GET', headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error(`GitHub API parse error: ${data.slice(0, 200)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('GitHub API timeout')); });
    req.end();
  });
}

async function searchGitHubRepos(query: string, limit: number = 10, token?: string): Promise<GitHubRepo[]> {
  const encoded = encodeURIComponent(query);
  const path = `/search/repositories?q=${encoded}&sort=stars&order=desc&per_page=${limit}`;
  const result = await githubApiRequest(path, token);
  return result.items || [];
}

async function analyzeRepo(owner: string, repo: string, token?: string): Promise<{
  repo: GitHubRepo | null;
  readme: string;
  packageJson: Record<string, unknown> | null;
  suggestedSkillType: string;
  suggestedToolName: string;
  suggestedExecute: string;
}> {
  const [repoInfo, readmeRes, pkgRes] = await Promise.allSettled([
    githubApiRequest(`/repos/${owner}/${repo}`, token),
    githubApiRequest(`/repos/${owner}/${repo}/readme`, token).then((d: any) => {
      if (d.content) return Buffer.from(d.content, 'base64').toString('utf-8');
      return '';
    }),
    githubApiRequest(`/repos/${owner}/${repo}/contents/package.json`, token).then((d: any) => {
      if (d.content) return JSON.parse(Buffer.from(d.content, 'base64').toString('utf-8'));
      return null;
    }),
  ]);

  const repoData = repoInfo.status === 'fulfilled' ? repoInfo.value : null;
  const readme = readmeRes.status === 'fulfilled' ? readmeRes.value : '';
  const packageJson = pkgRes.status === 'fulfilled' ? pkgRes.value : null;

  const lang = repoData?.language || '';
  let suggestedSkillType = 'tool';
  let suggestedToolName = repo?.replace(/[-_.]/g, '_').toLowerCase() || 'custom_tool';
  let suggestedExecute = '';

  if (lang === 'Python') {
    suggestedExecute = 'python';
    if (packageJson?.scripts?.start) suggestedExecute = `python ${packageJson.scripts.start}`;
  } else if (lang === 'JavaScript' || lang === 'TypeScript') {
    suggestedExecute = 'node';
    if (packageJson?.bin) suggestedExecute = 'npx';
    else if (packageJson?.scripts?.start) suggestedExecute = `npm start`;
  } else if (lang === 'Go') {
    suggestedExecute = 'go run .';
  } else if (lang === 'Rust') {
    suggestedExecute = 'cargo run';
  } else if (lang === 'Shell') {
    suggestedExecute = 'bash';
  }

  if (readme.toLowerCase().includes('cli') || readme.toLowerCase().includes('command-line')) {
    suggestedSkillType = 'tool';
  } else if (readme.toLowerCase().includes('agent') || readme.toLowerCase().includes('ai')) {
    suggestedSkillType = 'agent';
  } else if (readme.toLowerCase().includes('library') || readme.toLowerCase().includes('sdk')) {
    suggestedSkillType = 'library';
  }

  return { repo: repoData, readme, packageJson, suggestedSkillType, suggestedToolName, suggestedExecute };
}

function generateSkillId(owner: string, repo: string): string {
  return `gh_${owner}_${repo}`.replace(/[-_.]/g, '_').toLowerCase();
}

function generateToolSchema(repo: GitHubRepo, analysis: Awaited<ReturnType<typeof analyzeRepo>>): {
  toolName: string;
  toolDescription: string;
  toolParameters: string;
  executeCommand: string;
} {
  const toolName = analysis.suggestedToolName;
  const toolDescription = repo.description || `Execute ${repo.full_name} functionality`;
  const executeCommand = analysis.suggestedExecute;

  const params = {
    type: 'object',
    properties: {
      command: { type: 'string', description: `Command to execute via ${repo.full_name}` },
      args: { type: 'string', description: 'Arguments to pass' },
    },
    required: ['command'],
  };

  return { toolName, toolDescription, toolParameters: JSON.stringify(params), executeCommand };
}

function installSkillToDb(skill: InstalledSkill): void {
  if (!dbRef) throw new Error('Database not initialized');
  dbRef.run(`INSERT OR REPLACE INTO installed_skills (
    id, source, repo_url, repo_name, repo_owner, description, version, language, stars,
    skill_type, tool_name, tool_description, tool_parameters, execute_command, install_path, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    skill.id, skill.source, skill.repo_url, skill.repo_name, skill.repo_owner,
    skill.description, skill.version, skill.language, skill.stars,
    skill.skill_type, skill.tool_name, skill.tool_description, skill.tool_parameters,
    skill.execute_command, skill.install_path, skill.status,
  ]);
}

function uninstallSkillFromDb(id: string): boolean {
  if (!dbRef) throw new Error('Database not initialized');
  dbRef.run('UPDATE installed_skills SET status = ? WHERE id = ?', ['uninstalled', id]);
  return true;
}

function listInstalledSkills(): InstalledSkill[] {
  if (!dbRef) throw new Error('Database not initialized');
  const rows = dbRef.exec("SELECT * FROM installed_skills WHERE status = 'active' ORDER BY installed_at DESC");
  if (!rows || !rows[0] || !rows[0].values) return [];
  const cols = rows[0].columns;
  return rows[0].values.map((v: any[]) => {
    const obj: Record<string, any> = {};
    cols.forEach((c: string, i: number) => { obj[c] = v[i]; });
    return obj as InstalledSkill;
  });
}

function getSkillById(id: string): InstalledSkill | null {
  if (!dbRef) throw new Error('Database not initialized');
  const rows = dbRef.exec(`SELECT * FROM installed_skills WHERE id = ?`, [id]);
  if (!rows || !rows[0] || !rows[0].values || !rows[0].values[0]) return null;
  const cols = rows[0].columns;
  const obj: Record<string, any> = {};
  cols.forEach((c: string, i: number) => { obj[c] = rows[0].values[0][i]; });
  return obj as InstalledSkill;
}

export function registerGithubSkillIpc(): void {
  ipcMain.handle('github:search', async (_event, { query, limit, token }: { query: string; limit?: number; token?: string }) => {
    const repos = await searchGitHubRepos(query, limit || 10, token);
    return repos.map(r => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      description: r.description,
      url: r.html_url,
      stars: r.stargazers_count,
      language: r.language,
      topics: r.topics || [],
      license: r.license?.spdx_id || null,
    }));
  });

  ipcMain.handle('github:analyze', async (_event, { owner, repo, token }: { owner: string; repo: string; token?: string }) => {
    const analysis = await analyzeRepo(owner, repo, token);
    return {
      repo: analysis.repo ? {
        fullName: analysis.repo.full_name,
        description: analysis.repo.description,
        stars: analysis.repo.stargazers_count,
        language: analysis.repo.language,
        url: analysis.repo.html_url,
      } : null,
      readme: analysis.readme.slice(0, 5000),
      suggestedSkillType: analysis.suggestedSkillType,
      suggestedToolName: analysis.suggestedToolName,
      suggestedExecute: analysis.suggestedExecute,
      hasPackageJson: !!analysis.packageJson,
    };
  });

  ipcMain.handle('github-skill:install', async (_event, {
    owner, repo, token, skillType, toolName, toolDescription, executeCommand,
  }: {
    owner: string; repo: string; token?: string;
    skillType?: string; toolName?: string; toolDescription?: string; executeCommand?: string;
  }) => {
    const repoInfo = await githubApiRequest(`/repos/${owner}/${repo}`, token) as GitHubRepo;
    const analysis = await analyzeRepo(owner, repo, token);
    const schema = generateToolSchema(repoInfo, analysis);

    const skill: InstalledSkill = {
      id: generateSkillId(owner, repo),
      source: 'github',
      repo_url: repoInfo.html_url,
      repo_name: repo,
      repo_owner: owner,
      description: repoInfo.description || '',
      version: 'latest',
      language: repoInfo.language || '',
      stars: repoInfo.stargazers_count,
      skill_type: skillType || analysis.suggestedSkillType,
      tool_name: toolName || schema.toolName,
      tool_description: toolDescription || schema.toolDescription,
      tool_parameters: schema.toolParameters,
      execute_command: executeCommand || schema.executeCommand,
      install_path: '',
      status: 'active',
      installed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    installSkillToDb(skill);
    return { success: true, skill };
  });

  ipcMain.handle('github-skill:uninstall', async (_event, { id }: { id: string }) => {
    const result = uninstallSkillFromDb(id);
    return { success: result };
  });

  ipcMain.handle('github-skill:list', async () => {
    return listInstalledSkills();
  });
}
