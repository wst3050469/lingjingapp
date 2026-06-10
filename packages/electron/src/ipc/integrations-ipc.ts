// Integrations IPC handlers - GitHub / Supabase connection validation

import { ipcMain, safeStorage } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const GITHUB_CONFIG_PATH = join(homedir(), '.lingjing', 'github-config.json');

interface GitHubConfig {
  encryptedToken?: string;
  username?: string;
  avatar?: string;
  defaultRepo?: string;
  defaultBranch?: string;
  connected: boolean;
}

function encryptToken(token: string): string | null {
  // BUG-021: Only encrypt when safeStorage is available.
  // Base64 encoding is NOT encryption — reject storage to prevent plaintext token leaks.
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('[Integrations] safeStorage unavailable — refusing to store plaintext token');
    return null;
  }
  return safeStorage.encryptString(token).toString('base64');
}

function decryptToken(encrypted: string): string | null {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    }
    // BUG-021: No fallback decryption — if safeStorage was previously unavailable,
    // the token was never stored, so there's nothing to decrypt.
    return null;
  } catch {
    return null;
  }
}

async function loadGitHubConfig(): Promise<GitHubConfig> {
  try {
    if (existsSync(GITHUB_CONFIG_PATH)) {
      const raw = await readFile(GITHUB_CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return { connected: false };
}

async function saveGitHubConfig(config: GitHubConfig): Promise<void> {
  const dir = join(homedir(), '.lingjing');
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(GITHUB_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function githubRequest(url: string, headers: Record<string, string>): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { 'User-Agent': 'LingJing-Desktop', ...headers },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const resHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') resHeaders[k] = v;
            else if (Array.isArray(v)) resHeaders[k] = v[0];
          }
          resolve({ status: res.statusCode || 0, body: data, headers: resHeaders });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function githubRequestWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries: number = 3,
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const delays = [0, 1000, 2000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await githubRequest(url, headers);
      if (result.status === 403) {
        const remaining = result.headers['x-ratelimit-remaining'];
        if (remaining === '0') {
          const resetTime = parseInt(result.headers['x-ratelimit-reset'] || '0', 10) * 1000;
          const waitMs = Math.max(resetTime - Date.now(), 0);
          if (waitMs > 0 && waitMs < 60000 && i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }
          throw new Error(`GitHub API速率限制，请等待 ${Math.ceil(waitMs / 1000)} 秒后重试`);
        }
      }
      return result;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delays[i + 1]));
    }
  }
  throw new Error('GitHub API请求失败');
}

function httpsPost(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'User-Agent': 'LingJing-Desktop',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function readConfig(): Promise<Record<string, any>> {
  const configPath = join(homedir(), '.lingjing', 'config.json');
  try {
    const raw = await readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveConfig(config: Record<string, any>): Promise<void> {
  const configDir = join(homedir(), '.lingjing');
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }
  await writeFile(join(configDir, 'config.json'), JSON.stringify(config, null, 2));
}

export function registerIntegrationsIpc(): void {
  ipcMain.handle('integrations:github-validate', async (_event, { token }: { token: string }) => {
    try {
      const res = await githubRequestWithRetry('https://api.github.com/user', {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      });
      if (res.status === 200) {
        const user = JSON.parse(res.body);
        return { valid: true, username: user.login, avatar: user.avatar_url };
      }
      if (res.status === 401) {
        return { valid: false, error: 'GitHub Token无效或已过期，请重新生成' };
      }
      return { valid: false, error: `GitHub API returned ${res.status}` };
    } catch (err: any) {
      return { valid: false, error: err.message || 'Connection failed' };
    }
  });

  ipcMain.handle('integrations:github-connect', async (_event, { token }: { token: string }) => {
    try {
      const res = await githubRequestWithRetry('https://api.github.com/user', {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      });
      if (res.status === 200) {
        const user = JSON.parse(res.body);
        const ghConfig = await loadGitHubConfig();
        // BUG-021: encryptToken returns null if safeStorage is unavailable
        const encrypted = encryptToken(token);
        if (encrypted !== null) {
          ghConfig.encryptedToken = encrypted;
        } else {
          console.warn('[Integrations] Token encryption unavailable — connection will not persist across restarts');
        }
        ghConfig.username = user.login;
        ghConfig.avatar = user.avatar_url;
        ghConfig.connected = true;
        await saveGitHubConfig(ghConfig);

        const config = await readConfig();
        if (!config.integrations) config.integrations = {};
        config.integrations.github = { connected: true, username: user.login };
        await saveConfig(config);

        return { success: true, username: user.login };
      }
      if (res.status === 401) {
        return { success: false, error: 'GitHub Token无效或已过期，请重新生成' };
      }
      return { success: false, error: `GitHub API returned ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection failed' };
    }
  });

  ipcMain.handle('integrations:github-get-saved-token', async () => {
    try {
      const ghConfig = await loadGitHubConfig();
      if (ghConfig.connected && ghConfig.encryptedToken) {
        const token = decryptToken(ghConfig.encryptedToken);
        if (token) {
          return { connected: true, token, username: ghConfig.username };
        }
      }
      return { connected: false, token: null };
    } catch {
      return { connected: false, token: null };
    }
  });

  ipcMain.handle('integrations:github-disconnect', async () => {
    try {
      const ghConfig = await loadGitHubConfig();
      ghConfig.connected = false;
      ghConfig.encryptedToken = undefined;
      ghConfig.username = undefined;
      await saveGitHubConfig(ghConfig);

      const config = await readConfig();
      if (!config.integrations) config.integrations = {};
      config.integrations.github = { connected: false, username: '', token: '' };
      await saveConfig(config);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('github:get-config', async () => {
    const ghConfig = await loadGitHubConfig();
    return {
      connected: ghConfig.connected,
      username: ghConfig.username,
      avatar: ghConfig.avatar,
      defaultRepo: ghConfig.defaultRepo,
      defaultBranch: ghConfig.defaultBranch,
    };
  });

  ipcMain.handle('github:save-config', async (_event, { defaultRepo, defaultBranch }: { defaultRepo?: string; defaultBranch?: string }) => {
    const ghConfig = await loadGitHubConfig();
    if (defaultRepo !== undefined) ghConfig.defaultRepo = defaultRepo;
    if (defaultBranch !== undefined) ghConfig.defaultBranch = defaultBranch;
    await saveGitHubConfig(ghConfig);
    return { success: true };
  });

  ipcMain.handle('github:clone-repo', async (_event, { repoUrl, localPath }: { repoUrl: string; localPath: string }) => {
    try {
      const ghConfig = await loadGitHubConfig();
      let cloneUrl = repoUrl;
      if (ghConfig.encryptedToken) {
        const token = decryptToken(ghConfig.encryptedToken);
        if (token && repoUrl.includes('github.com')) {
          cloneUrl = repoUrl.replace('https://github.com', `https://${token}@github.com`);
        }
      }
      await execFileAsync('git', ['clone', cloneUrl, localPath], { timeout: 120000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `仓库克隆失败: ${err.message}` };
    }
  });

  ipcMain.handle('github:create-pr', async (_event, { owner, repo, head, base, title, body: prBody }: {
    owner: string; repo: string; head: string; base: string; title: string; body?: string;
  }) => {
    try {
      const ghConfig = await loadGitHubConfig();
      if (!ghConfig.encryptedToken) {
        return { success: false, error: 'GitHub未连接，请先配置Token' };
      }
      const token = decryptToken(ghConfig.encryptedToken);
      if (!token) {
        return { success: false, error: 'GitHub Token解密失败，请重新连接' };
      }

      const res = await httpsPost(
        `https://api.github.com/repos/${owner}/${repo}/pulls`,
        {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        JSON.stringify({ title, head, base, body: prBody || '' }),
      );

      if (res.status === 201) {
        const pr = JSON.parse(res.body);
        return { success: true, prUrl: pr.html_url, prNumber: pr.number };
      }
      if (res.status === 401) {
        return { success: false, error: 'GitHub Token无效或已过期' };
      }
      if (res.status === 422) {
        const errData = JSON.parse(res.body);
        return { success: false, error: `创建PR失败: ${errData.message || 'Validation error'}` };
      }
      return { success: false, error: `创建PR失败: HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: `创建PR失败: ${err.message}` };
    }
  });

  ipcMain.handle('github:list-branches', async (_event, { owner, repo }: { owner: string; repo: string }) => {
    try {
      const ghConfig = await loadGitHubConfig();
      if (!ghConfig.encryptedToken) {
        return { success: false, error: 'GitHub未连接' };
      }
      const token = decryptToken(ghConfig.encryptedToken);
      if (!token) {
        return { success: false, error: 'Token解密失败' };
      }

      const res = await githubRequestWithRetry(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
        {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      );

      if (res.status === 200) {
        const branches = JSON.parse(res.body);
        return { success: true, branches: branches.map((b: any) => b.name) };
      }
      return { success: false, error: `获取分支列表失败: HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('integrations:supabase-validate', async (_event, { projectUrl, anonKey }: { projectUrl: string; anonKey: string }) => {
    try {
      const url = projectUrl.replace(/\/$/, '') + '/rest/v1/';
      const res = await githubRequest(url, {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      });
      if (res.status === 200) {
        return { valid: true };
      }
      return { valid: false, error: `Supabase returned ${res.status}` };
    } catch (err: any) {
      return { valid: false, error: err.message || 'Connection failed' };
    }
  });

  ipcMain.handle('integrations:supabase-connect', async (_event, { projectUrl, anonKey }: { projectUrl: string; anonKey: string }) => {
    try {
      const url = projectUrl.replace(/\/$/, '') + '/rest/v1/';
      const res = await githubRequest(url, {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      });
      if (res.status === 200) {
        const config = await readConfig();
        if (!config.integrations) config.integrations = {};
        config.integrations.supabase = {
          connected: true,
          projectUrl: projectUrl.replace(/\/$/, ''),
          anonKey,
        };
        await saveConfig(config);
        return { success: true };
      }
      return { success: false, error: `Supabase returned ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection failed' };
    }
  });

  ipcMain.handle('integrations:supabase-disconnect', async () => {
    try {
      const config = await readConfig();
      if (!config.integrations) config.integrations = {};
      config.integrations.supabase = {
        connected: false,
        projectUrl: '',
        anonKey: '',
      };
      await saveConfig(config);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
