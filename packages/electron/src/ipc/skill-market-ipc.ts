// Skill Market IPC - Handles marketplace integration with skills.sh and GitHub
import { ipcMain } from 'electron';
import { exec } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, access, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import https from 'node:https';
import http from 'node:http';

const SKILLS_SH_API = 'skills.sh';
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
  const { statusCode, data } = await httpsGet(`https://${SKILLS_SH_API}/api/v1/skills?page=${page}&per_page=${limit}`);
  if (statusCode !== 200) throw new Error(`skills.sh API returned ${statusCode}`);
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
  return { skills, hasMore: json.has_more || json.data?.length === limit };
}

async function searchSkills(query: string, page: number, limit: number): Promise<{ skills: SkillItem[]; hasMore: boolean }> {
  const encoded = encodeURIComponent(query);
  const { statusCode, data } = await httpsGet(`https://${SKILLS_SH_API}/api/v1/skills/search?q=${encoded}&page=${page}&per_page=${limit}`);
  if (statusCode !== 200) throw new Error(`skills.sh API returned ${statusCode}`);
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
  return { skills, hasMore: json.has_more || json.data?.length === limit };
}

async function fetchSkillDetail(source: string, slug: string): Promise<{ files: Record<string, string>; version?: string }> {
  const { statusCode, data } = await httpsGet(`https://${SKILLS_SH_API}/api/v1/skills/${source}/${slug}`);
  if (statusCode !== 200) throw new Error(`Failed to fetch skill detail: ${statusCode}`);
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
      const { page = 1, limit = 20 } = args || {};
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

      // Parse source and slug from skillId (format: "source/slug")
      const [source, slug] = skillId.includes('/')
        ? skillId.split('/', 2)
        : ['www', skillId];

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

      await new Promise<void>((resolve, reject) => {
        exec(`git clone --depth 1 "${url}" "${tmpDir}"`, { timeout: 120000 }, (err) => {
          if (err) reject(new Error(`Git clone 失败: ${err.message}`));
          else resolve();
        });
      });

      // Analyze repo and generate SKILL.md
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

      // Build SKILL.md content
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

      // Write skill to local directory
      const targetDir = join(SKILLS_DIR, skillName);
      await mkdir(targetDir, { recursive: true });
      await writeFile(join(targetDir, 'SKILL.md'), skillMdContent, 'utf-8');

      // Clean up temp
      rm(tmpDir, { recursive: true, force: true }).catch(() => {});

      return { success: true, name: skillName, skillPath: targetDir };
    } catch (error: any) {
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
          const { statusCode, data } = await httpsGet(`https://${SKILLS_SH_API}/api/v1/skills/www/${encodeURIComponent(dir)}`);
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
