// Skill Market IPC - Handles marketplace integration with skills.sh and GitHub
import { ipcMain, BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, access, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import https from 'node:https';
import http from 'node:http';

// Use cloud server as skills.sh proxy (skills.sh now requires Vercel OIDC auth)
const CLOUD_SERVER = 'ide.zhejiangjinmo.com';
const SKILLS_SH_PROXY = `${CLOUD_SERVER}/api/skills-proxy`;
const SKILLS_DIR = join(homedir(), '.lingjing', 'skills');

// ─── HTTP Helpers ───────────────────────────────────────────────

function httpsGet(url: string): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'LingJing/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk.toString());
      res.on('end', () => resolve({ statusCode: res.statusCode || 200, data }));
    }).on('error', reject);
  });
}

// ─── Skills.sh API ──────────────────────────────────────────────

interface SkillItem {
  id: string;
  name: string;
  description: string;
  source: string;
  installs: number;
  version?: string;
  isDuplicate?: boolean;
  remoteUrl?: string;
}

async function fetchLeaderboard(page: number, limit: number): Promise<{ skills: SkillItem[]; hasMore: boolean }> {
  const { statusCode, data } = await httpsGet(`https://${SKILLS_SH_PROXY}/skills?page=${page}&per_page=${limit}`);
  if (statusCode !== 200) throw new Error(`技能市场 API 返回 ${statusCode}`);
  const json = JSON.parse(data);
  const skills: SkillItem[] = (json.data || []).map((s: any) => ({
    id: `${s.source || 'www'}/${s.slug || s.name}`,
    name: s.name || s.slug,
    description: s.description || '',
    source: s.source || 'www',
    installs: s.installs || 0,
    version: s.version || '1.0.0',
    remoteUrl: s.url || `https://skills.sh/${s.source || 'www'}/${s.slug || s.name}`,
  }));
  return { skills, hasMore: json.hasMore !== undefined ? json.hasMore : json.data?.length === limit };
}

async function searchSkills(query: string, page: number, limit: number): Promise<{ skills: SkillItem[]; hasMore: boolean }> {
  const encoded = encodeURIComponent(query);
  const { statusCode, data } = await httpsGet(`https://${SKILLS_SH_PROXY}/skills/search?q=${encoded}&page=${page}&per_page=${limit}`);
  if (statusCode !== 200) throw new Error(`技能市场搜索返回 ${statusCode}`);
  const json = JSON.parse(data);
  const skills: SkillItem[] = (json.data || []).map((s: any) => ({
    id: `${s.source || 'www'}/${s.slug || s.name}`,
    name: s.name || s.slug,
    description: s.description || '',
    source: s.source || 'www',
    installs: s.installs || 0,
    version: s.version || '1.0.0',
    remoteUrl: s.url || `https://skills.sh/${s.source || 'www'}/${s.slug || s.name}`,
  }));
  return { skills, hasMore: json.hasMore !== undefined ? json.hasMore : json.data?.length === limit };
}

async function fetchSkillDetail(source: string, slug: string): Promise<{ files: Record<string, string>; version?: string }> {
  // Encode source to handle multi-segment paths (e.g., 'anthropics/skills' → 'anthropics%2Fskills')
  // Express routes only match single path segments; encoding prevents 404 on multi-segment sources
  const encodedSource = encodeURIComponent(source);
  const encodedSlug = encodeURIComponent(slug);
  const { statusCode, data } = await httpsGet(`https://${SKILLS_SH_PROXY}/skills/${encodedSource}/${encodedSlug}`);
  if (statusCode !== 200) throw new Error(`获取技能详情失败: ${statusCode}`);
  const json = JSON.parse(data);
  return { files: json.files || {}, version: json.version };
}

// ─── Local Skill Helpers ────────────────────────────────────────

async function ensureSkillsDir(): Promise<void> {
  await mkdir(SKILLS_DIR, { recursive: true });
}

async function extractVersionFromSkillMd(skillPath: string): Promise<string | null> {
  try {
    const mdPath = join(skillPath, 'SKILL.md');
    const content = await readFile(mdPath, 'utf-8');
    const match = content.match(/version:\s*['"]?([\d.]+)['"]?/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ─── IPC Registration ───────────────────────────────────────────

export function registerSkillMarketIpc(): void {
  // Get leaderboard (trending/popular skills)
  ipcMain.handle('skill-market:get-leaderboard', async (_event, args: { page?: number; limit?: number }) => {
    try {
      const { page = 1, limit = 200 } = args || {};
      const { skills, hasMore } = await fetchLeaderboard(page, limit);

      // Check which are already installed
      await ensureSkillsDir();
      let installedNames = new Set<string>();
      try {
        const dirs = await readdir(SKILLS_DIR);
        for (const dir of dirs) {
          const sp = join(SKILLS_DIR, dir);
          try { const st = await stat(sp); if (st.isDirectory()) installedNames.add(dir); } catch {}
        }
      } catch {}

      const data = skills.map(s => ({
        ...s,
        isDuplicate: installedNames.has(s.name),
      }));

      return { success: true, data, hasMore };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Search skills
  ipcMain.handle('skill-market:search', async (_event, args: { query?: string; page?: number; limit?: number }) => {
    try {
      const { query = '', page = 1, limit = 30 } = args || {};
      if (!query.trim()) {
        const { skills, hasMore } = await fetchLeaderboard(page, limit);
        return { success: true, data: skills, hasMore };
      }
      const { skills, hasMore } = await searchSkills(query, page, limit);

      await ensureSkillsDir();
      let installedNames = new Set<string>();
      try {
        const dirs = await readdir(SKILLS_DIR);
        for (const dir of dirs) {
          const sp = join(SKILLS_DIR, dir);
          try { const st = await stat(sp); if (st.isDirectory()) installedNames.add(dir); } catch {}
        }
      } catch {}

      const data = skills.map(s => ({
        ...s,
        isDuplicate: installedNames.has(s.name),
      }));

      return { success: true, data, hasMore };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get installed skill IDs
  ipcMain.handle('skill-market:get-installed-ids', async () => {
    try {
      await ensureSkillsDir();
      const ids: Record<string, boolean> = {};
      try {
        const dirs = await readdir(SKILLS_DIR);
        for (const dir of dirs) {
          const sp = join(SKILLS_DIR, dir);
          try { const st = await stat(sp); if (st.isDirectory()) ids[dir] = true; } catch {}
        }
      } catch {}
      return { success: true, data: ids };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Install skill from skills.sh
  ipcMain.handle('skill-market:install', async (_event, args: { skillId: string; skill: SkillItem }) => {
    try {
      const { skillId, skill } = args;
      await ensureSkillsDir();

      // Parse source and slug correctly:
      // skill.source may contain '/' (e.g. 'anthropics/skills')
      // skill.name is the last path segment (the actual slug)
      const source = skill.source || 'www';
      const slug = skill.name || skillId;

      // Fetch skill files from API
      const { files } = await fetchSkillDetail(source, slug);

      // Create skill directory
      const skillDir = join(SKILLS_DIR, skill.name);
      await mkdir(skillDir, { recursive: true });

      // Write all files
      for (const [filename, content] of Object.entries(files)) {
        const filePath = join(skillDir, filename);
        const parentDir = dirname(filePath);
        await mkdir(parentDir, { recursive: true });
        await writeFile(filePath, content, 'utf-8');
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Helper: send progress event to renderer
  function sendGithubImportProgress(step: string, detail?: string) {
    console.log(`[SkillMarket] GitHub import: ${step} - ${detail || ''}`);
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('skill-market:github-import-progress', { step, detail, timestamp: Date.now() });
    } else {
      console.warn('[SkillMarket] No browser window available, progress sent to log only');
    }
  }

  // Install from GitHub
  ipcMain.handle('skill-market:install-from-github', async (_event, args: { url: string }) => {
    try {
      const { url } = args;
      if (!url || !url.includes('github.com')) {
        return { success: false, error: '请提供有效的 GitHub 开源仓库地址' };
      }

      // Parse owner/repo from URL
      const match = url.match(/github\.com\/([^\/\s]+)\/([^\/\s\.]+)/);
      if (!match) {
        return { success: false, error: '无法解析 GitHub 仓库地址' };
      }
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, '');
      const skillName = repo;

      await ensureSkillsDir();

      // Clone repo to temp directory
      const tmpDir = join(homedir(), '.lingjing', '.tmp', `gh-${Date.now()}`);
      await mkdir(join(homedir(), '.lingjing', '.tmp'), { recursive: true });

      // Step 1: Clone repository
      sendGithubImportProgress('clone', `正在克隆 ${owner}/${repo}...`);
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('git', ['clone', '--depth', '1', '--progress', url, tmpDir], {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true, // ensure git is found on Windows
          windowsHide: true,
        });

        let settled = false;
        const finish = (fn: () => void) => {
          if (!settled) { settled = true; clearTimeout(timer); fn(); }
        };

        // Manual timeout (more reliable than spawn's built-in timeout option)
        const timer = setTimeout(() => {
          proc.kill('SIGKILL');
          finish(() => reject(new Error(`Git clone 超时 (120s): ${owner}/${repo}`)));
        }, 120000);

        // Accumulated stderr buffer — git outputs progress in chunks,
        // and a percentage number may be split across chunks (e.g., "10" and "0%")
        let stderrBuf = '';
        proc.stderr.on('data', (chunk: Buffer) => {
          stderrBuf += chunk.toString();
          // Git outputs clone progress to stderr (English + Chinese variants)
          let pctMatch = stderrBuf.match(/Receiving objects:\s*(\d+)%/);
          if (!pctMatch) pctMatch = stderrBuf.match(/接收对象中:\s*(\d+)%/);
          if (!pctMatch) pctMatch = stderrBuf.match(/接收对象:\s*(\d+)%/);
          if (pctMatch) {
            sendGithubImportProgress('clone', `克隆中... ${pctMatch[1]}%`);
          }
          let doneMatch = stderrBuf.match(/Resolving deltas:\s*(\d+)%/);
          if (!doneMatch) doneMatch = stderrBuf.match(/处理 delta 中:\s*(\d+)%/);
          if (!doneMatch) doneMatch = stderrBuf.match(/处理delta中:\s*(\d+)%/);
          if (doneMatch) {
            sendGithubImportProgress('clone', `处理中... ${doneMatch[1]}%`);
          }
          // Limit buffer growth
          if (stderrBuf.length > 10000) stderrBuf = stderrBuf.slice(-5000);
        });

        proc.on('close', (code) => {
          if (code === 0) finish(resolve);
          else finish(() => reject(new Error(`Git clone 失败 (code: ${code})`)));
        });

        proc.on('error', (err) => {
          const msg = (err as any)?.code === 'ENOENT'
            ? 'Git 未安装或不在 PATH 中，请先安装 Git'
            : `Git clone 失败: ${err.message}`;
          finish(() => reject(new Error(msg)));
        });
      });

      // Step 2: Analyze repository
      sendGithubImportProgress('analyze', `正在分析仓库结构...`);
      // Yield microtask so renderer renders this progress step before continuing
      await new Promise(r => setTimeout(r, 10));
      let readmeContent = '';
      let pkgJson: any = {};
      try {
        readmeContent = await readFile(join(tmpDir, 'README.md'), 'utf-8');
      } catch {
        try { readmeContent = await readFile(join(tmpDir, 'readme.md'), 'utf-8'); } catch {}
      }
      try {
        pkgJson = JSON.parse(await readFile(join(tmpDir, 'package.json'), 'utf-8'));
      } catch {
        try { pkgJson = JSON.parse(await readFile(join(tmpDir, 'pyproject.toml'), 'utf-8')); } catch {}
      }

      // Generate description from README first paragraph
      const descMatch = readmeContent.match(/^#\s+[^\n]+\n\n([^\n]+)/m);
      const description = descMatch ? descMatch[1].trim() : `A skill for ${repo} - ${pkgJson.description || 'No description available'}`.slice(0, 200);

      // Step 3: Generate SKILL.md
      sendGithubImportProgress('generate', `正在生成技能文件...`);
      await new Promise(r => setTimeout(r, 10));
      const skillMdContent = [
        '---',
        `name: ${skillName}`,
        `version: ${pkgJson.version || '0.1.0'}`,
        `source: github`,
        `repo: ${url}`,
        `description: ${description}`,
        '---',
        '',
        `# ${skillName}`,
        '',
        description,
        '',
        '## Overview',
        `This skill wraps the [${owner}/${repo}](${url}) repository.`,
        '',
        '> Auto-generated by LingJing Skill Market from GitHub repository analysis.',
      ].join('\n');

      // Step 4: Write skill to local directory
      sendGithubImportProgress('write', `正在写入技能...`);
      await new Promise(r => setTimeout(r, 10));
      const targetDir = join(SKILLS_DIR, skillName);
      await mkdir(targetDir, { recursive: true });
      await writeFile(join(targetDir, 'SKILL.md'), skillMdContent, 'utf-8');

      // Clean up temp
      rm(tmpDir, { recursive: true, force: true }).catch(() => {});

      sendGithubImportProgress('done', `技能 ${skillName} 生成完成！`);
      return { success: true, name: skillName, skillPath: targetDir };
    } catch (error: any) {
      sendGithubImportProgress('error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Check for updates on installed skills
  ipcMain.handle('skill-market:check-updates', async () => {
    try {
      await ensureSkillsDir();
      const updates: Array<{ skillName: string; skillPath: string; localVersion: string; latestVersion: string }> = [];

      let dirs: string[] = [];
      try { dirs = await readdir(SKILLS_DIR); } catch { return { success: true, updates: [] }; }

      for (const dir of dirs) {
        const skillPath = join(SKILLS_DIR, dir);
        try {
          const st = await stat(skillPath);
          if (!st.isDirectory()) continue;
        } catch { continue; }

        const localVersion = await extractVersionFromSkillMd(skillPath);
        if (!localVersion) continue;

        // Try to fetch latest version from skills.sh or GitHub
        // For skills.sh skills, check for updates
        try {
          const { statusCode, data } = await httpsGet(`https://${SKILLS_SH_PROXY}/skills/www/${encodeURIComponent(dir)}`);
          if (statusCode === 200) {
            const json = JSON.parse(data);
            const latest = json.version;
            if (latest && latest !== localVersion) {
              updates.push({ skillName: dir, skillPath, localVersion, latestVersion: latest });
            }
          }
        } catch {
          // Skill not found on skills.sh - skip
        }
      }

      return { success: true, updates };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Update a specific skill
  ipcMain.handle('skill-market:update', async (_event, args: { skillPath: string }) => {
    try {
      const { skillPath } = args;
      if (!existsSync(skillPath)) {
        return { success: false, error: '技能目录不存在' };
      }

      const skillName = skillPath.split(/[\\/]/).pop() || '';
      
      // Try to re-fetch from skills.sh
      const { files } = await fetchSkillDetail('www', skillName);

      // Overwrite files
      for (const [filename, content] of Object.entries(files)) {
        const filePath = join(skillPath, filename);
        const parentDir = dirname(filePath);
        await mkdir(parentDir, { recursive: true });
        await writeFile(filePath, content, 'utf-8');
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
