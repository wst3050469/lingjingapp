// 灵境 Cloud IPC - 云端会话同步 & 记忆同步
// Bridges Electron IPC <-> CloudSyncClient

import { ipcMain, BrowserWindow, app } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
// @ts-ignore -- CloudSyncOptions not yet exported from @codepilot/core dist
import { CloudSyncClient, type CloudSyncOptions } from '@codepilot/core';
import { getDatabase, saveDatabase } from '../db/database.js';
import { saveMemoryWithDedup } from '../services/memory-service.js';
// Use console for logging since @codepilot/core logger has compatibility issues with esbuild bundling
const logger = console;

let cloudClient: CloudSyncClient | null = null;
let mainWindow: BrowserWindow | null = null;
let cloudRetryTimer: ReturnType<typeof setInterval> | null = null;
let isConnecting = false; // Prevents dual client creation during auto-connect

// ── Config Persistence ──

function getConfigPath(): string {
  try {
    return resolve(app.getPath('userData'), 'cloud-sync-config.json');
  } catch {
    return '';
  }
}

function loadCloudConfig(): { url?: string; apiKey?: string } | null {
  try {
    const configPath = getConfigPath();
    if (!configPath || !existsSync(configPath)) return null;
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

function saveCloudConfig(config: { url?: string; apiKey?: string }): void {
  try {
    const configPath = getConfigPath();
    if (!configPath) return;
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('[Cloud] Config saved');
  } catch (err) {
    console.warn('[Cloud] Failed to save config:', err);
  }
}

export function registerCloudIpc(win: BrowserWindow): void {
  mainWindow = win;

  // ── Lifecycle ──

  ipcMain.handle('cloud:connect', async (_event, opts?: CloudSyncOptions) => {
    try {
      // Stop auto-retry timer when user manually connects
      if (cloudRetryTimer) { clearInterval(cloudRetryTimer); cloudRetryTimer = null; }
      if (cloudClient) cloudClient.disconnect();
      isConnecting = true;
      cloudClient = new CloudSyncClient(opts || {});

      // Auto-register for JWT
      const registered = await cloudClient.autoRegister();

      // Connect WebSocket
      cloudClient.connectWebSocket();

      // Wait for WebSocket connection to be established
      const wsConnected = await Promise.race([
        new Promise(resolve => {
          cloudClient!.on('connected', () => resolve(true));
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('WebSocket connection timeout after 10s')), 10000)
        ),
      ]);

      // Listen for events → push to renderer
      cloudClient.on('connected', (data) => {
        mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });
      });
      cloudClient.on('disconnected', () => {
        mainWindow?.webContents.send('cloud:status', { connected: false });
      });
      cloudClient.on('sync', (payload) => {
        mainWindow?.webContents.send('cloud:sync-event', payload);
      });
      cloudClient.on('webhook', (data) => {
        mainWindow?.webContents.send('cloud:webhook-event', data);
      });
      cloudClient.on('relay:from-mobile', (data) => {
        console.log('[Cloud] Relay message from mobile:', data?.payload?.type);
        mainWindow?.webContents.send('cloud:relay-message', data);
      });

      const healthy = await cloudClient.healthCheck().catch(e => {
        console.warn('[Cloud] healthCheck failed after WS connected:', e);
        return true; // WS connected, consider it healthy even if HTTP health check fails
      });
      isConnecting = false;
      return { connected: true, healthy, wsConnected, registered, deviceId: cloudClient.getDeviceId() };
    } catch (err) {
      isConnecting = false;
      return { connected: false, error: String(err) };
    }
  });

  ipcMain.handle('cloud:disconnect', async () => {
    if (cloudRetryTimer) { clearInterval(cloudRetryTimer); cloudRetryTimer = null; }
    if (cloudClient) {
      cloudClient.disconnect();
      cloudClient = null;
    }
    isConnecting = false;
    return { ok: true };
  });

  ipcMain.handle('cloud:status', async () => {
    if (!cloudClient) return { connected: false, healthy: false };
    // Use Node http for healthCheck (fetch may fail in ASAR environment)
    let healthy = false;
    try {
      const clientUrl = (cloudClient as any).url || 'https://ide.zhejiangjinmo.com';
      const healthUrl = new URL('/api/health', clientUrl);
      healthy = await new Promise<boolean>((resolve) => {
        const lib = healthUrl.protocol === 'https:' ? https : http;
        const req = lib.get(healthUrl.toString(), { timeout: 5000 }, (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          res.on('end', () => {
            try { resolve(JSON.parse(body).status === 'ok'); } catch { resolve(false); }
          });
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });
    } catch { healthy = false; }
    return { connected: true, healthy };
  });

  /** Set user JWT token on the sync client (after cloud account login) */
  ipcMain.handle('cloud:set-user-token', async (_event, token: string) => {
    if (!cloudClient) {
      // Create client first
      cloudClient = new CloudSyncClient({});
      // Wait for device registration so we have a fallback
      await cloudClient.autoRegister().catch(() => {});
    }
    // Set the user JWT - this overrides the device JWT for all API calls
    cloudClient.setToken(token);
    logger.info('[Cloud] User JWT bound to sync client');
    
    // Connect WebSocket with user token
    cloudClient.connectWebSocket();
    
    // Set up event listeners
    cloudClient.on('connected', (data) => {
      mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });
    });
    cloudClient.on('disconnected', () => {
      mainWindow?.webContents.send('cloud:status', { connected: false });
    });
    cloudClient.on('sync', (payload) => {
      mainWindow?.webContents.send('cloud:sync-event', payload);
    });
    cloudClient.on('webhook', (data) => {
      mainWindow?.webContents.send('cloud:webhook-event', data);
    });
    cloudClient.on('relay:from-mobile', (data) => {
      console.log('[Cloud] Relay message from mobile:', data?.payload?.type);
      mainWindow?.webContents.send('cloud:relay-message', data);
    });

    // Wait briefly for WebSocket to connect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const healthy = await cloudClient.healthCheck().catch(() => false);
    return { ok: true, connected: true, healthy, deviceId: cloudClient.getDeviceId() };
  });

  // ── HTTP Proxy API (bypass CORS for renderer fetch) ──

  ipcMain.handle('cloud:proxy-api', async (_event, opts: {
    endpoint: string;
    method?: string;
    body?: unknown;
    token?: string;
    baseUrl?: string;
  }) => {
    const baseUrl = opts.baseUrl || 'https://ide.zhejiangjinmo.com';
    const url = new URL(`${baseUrl}/api${opts.endpoint}`);
    const method = opts.method || 'GET';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

    return new Promise((resolve, reject) => {
      const bodyData = opts.body ? JSON.stringify(opts.body) : undefined;
      if (bodyData) headers['Content-Length'] = Buffer.byteLength(bodyData).toString();

      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(
        url,
        {
          method,
          headers,
          rejectUnauthorized: true,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
              const parsed = JSON.parse(raw);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(parsed);
              } else {
                reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
              }
            } catch {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(raw);
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
              }
            }
          });
        }
      );
      req.on('error', (err: Error) => {
        if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('ENETUNREACH')) {
          reject(new Error('无法连接到云服务器，请检查网络连接或确认服务器地址是否正确'));
        } else if (err.message.includes('CERT') || err.message.includes('SSL')) {
          reject(new Error('云服务器SSL证书验证失败，请检查系统时间或网络环境'));
        } else {
          reject(new Error(`网络请求失败: ${err.message}`));
        }
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时（15秒），请检查网络连接或服务器状态'));
      });
      req.setTimeout(15000);

      if (bodyData) req.write(bodyData);
      req.end();
    });
  });

  // ── Config Persistence IPC ──

  ipcMain.handle('cloud:save-config', async (_event, config: { url?: string; apiKey?: string }) => {
    saveCloudConfig(config);
    return { ok: true };
  });

  ipcMain.handle('cloud:get-config', async () => {
    return loadCloudConfig() || {};
  });

  // ── Sessions ──

  ipcMain.handle('cloud:sessions:list', async () => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.listSessions();
  });

  ipcMain.handle('cloud:sessions:get', async (_event, id: string) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.getSession(id);
  });

  ipcMain.handle('cloud:sessions:upsert', async (_event, session: {
    id: string; title?: string; messages?: any[]; metadata?: any;
  }) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.upsertSession(session);
  });

  ipcMain.handle('cloud:sessions:delete', async (_event, id: string) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.deleteSession(id);
  });

  // ── Memories ──

  ipcMain.handle('cloud:memories:list', async (_event, query?: string) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.listMemories(query);
  });

  ipcMain.handle('cloud:memories:upsert', async (_event, memory: {
    id?: string; title: string; content: string; category?: string; scope?: 'global' | 'project';
  }) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.upsertMemory(memory);
  });

  ipcMain.handle('cloud:memories:delete', async (_event, id: string) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.deleteMemory(id);
  });

  // ── Cloud Memory Search (semantic search across devices) ──

  ipcMain.handle('cloud:memories:search', async (_event, { query }: { query: string }) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.listMemories(query);
  });

  // ── Pull memories from cloud → merge into local SQLite ──

  ipcMain.handle('memory:pull-from-cloud', async () => {
    if (!cloudClient) {
      return { success: false, error: 'Cloud not connected' };
    }
    try {
      const cloudMemories = await cloudClient.listMemories();
      if (!Array.isArray(cloudMemories) || cloudMemories.length === 0) {
        return { success: true, count: 0 };
      }

      const db = getDatabase();
      let count = 0;
      for (const cm of cloudMemories) {
        await saveMemoryWithDedup(db, saveDatabase, {
          scope: (cm.scope === 'global' ? 'global' : 'project') as 'global' | 'project',
          projectPath: cm.scope !== 'global' ? (cm as any).project_path || null : null,
          category: cm.category || 'knowledge',
          title: cm.title,
          content: cm.content,
          source: 'automatic',
        });
        count++;
      }
      console.log(`[Cloud] Pulled ${count} memories from cloud and merged into local DB`);
      return { success: true, count };
    } catch (err) {
      console.error('[Cloud] Failed to pull memories:', err);
      return { success: false, error: String(err) };
    }
  });

  // ── Webhooks ──

  ipcMain.handle('cloud:webhook:trigger', async (_event, channel: string, payload: any) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.triggerWebhook(channel, payload);
  });

  ipcMain.handle('cloud:webhook:logs', async (_event, channel: string) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.getWebhookLogs(channel);
  });

  // ── Auto-sync push handlers (called by renderer after local save) ──

  ipcMain.handle('cloud:push-session', async (_event, session: {
    id: string; title?: string; messages?: any[]; metadata?: any;
  }) => {
    await pushSessionToCloud(session);
    return { ok: true };
  });

  // ── Relay messages (desktop ↔ mobile via cloud) ──
  ipcMain.handle('cloud:relay-send', async (_event, opts: { type: string; payload: any; correlationId?: string }) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    // @ts-ignore - sendRelayMessage exists on _sendRaw at runtime
    cloudClient.sendRelayMessage(opts.type, opts.payload, opts.correlationId);
    return { ok: true };
  });

  ipcMain.handle('cloud:push-memory', async (_event, memory: {
    title: string; content: string; category?: string; scope?: 'global' | 'project';
  }) => {
    await pushMemoryToCloud(memory);
    return { ok: true };
  });
}

/** Auto-connect to cloud on app start (if configured). Retries persistently. */
export async function autoConnectCloud(): Promise<void> {
  // Prevent dual client creation when cloud:connect is also being called
  if (isConnecting) {
    console.log('[Cloud] Already connecting, skipping auto-connect');
    return;
  }
  isConnecting = true;

  // Helper: attempt a single connection
  const tryConnect = async (): Promise<boolean> => {
    try {
      // Reuse existing client if it's already connected (WebSocket open)
      if (cloudClient) {
        try {
          const healthy = await cloudClient.healthCheck();
          if (healthy) {
            console.log('[Cloud] Already connected, skipping reconnect');
            return true;
          }
        } catch {
          // Health check failed, will create new client below
        }
        // Disconnect stale client before creating new one
        try { cloudClient.disconnect(); } catch {}
        cloudClient = null;
      }

      // Read persisted config for custom URL/API Key
      const savedConfig = loadCloudConfig();
      const connectOpts: any = {};
      if (savedConfig?.url) connectOpts.url = savedConfig.url;
      if (savedConfig?.apiKey) connectOpts.apiKey = savedConfig.apiKey;
      if (Object.keys(connectOpts).length > 0) {
        console.log('[Cloud] Using saved config:', connectOpts.url ? 'url:' + connectOpts.url : 'default');
      }

      cloudClient = new CloudSyncClient(Object.keys(connectOpts).length > 0 ? connectOpts : undefined);

      // Auto-register device to get JWT token before connecting
      const registered = await cloudClient.autoRegister();
      if (registered) {
        console.log('[Cloud] Device auto-registered successfully');
      }

      // Try WebSocket directly — don't gate on health check
      // (health check may fail due to firewall/proxy while WebSocket works)
      cloudClient.connectWebSocket();

      // Set up event listeners
      cloudClient.on('connected', (data) => {
        console.log('[Cloud] WebSocket connected');
        mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });
      });
      cloudClient.on('disconnected', () => {
        console.log('[Cloud] WebSocket disconnected');
        mainWindow?.webContents.send('cloud:status', { connected: false });
      });
      cloudClient.on('sync', (payload) => {
        mainWindow?.webContents.send('cloud:sync-event', payload);
      });
      cloudClient.on('webhook', (data) => {
        mainWindow?.webContents.send('cloud:webhook-event', data);
      });
      cloudClient.on('relay:from-mobile', (data) => {
        console.log('[Cloud] Relay message from mobile:', data?.payload?.type);
        mainWindow?.webContents.send('cloud:relay-message', data);
      });

      // Wait briefly for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check health to confirm connectivity (use Node http for ASAR compatibility)
      let healthy = false;
      try {
        const clientUrl = (cloudClient as any).url || 'https://ide.zhejiangjinmo.com';
        const healthUrl = new URL('/api/health', clientUrl);
        healthy = await new Promise<boolean>((resolve) => {
          const lib = healthUrl.protocol === 'https:' ? https : http;
          const req = lib.get(healthUrl.toString(), { timeout: 5000 }, (res) => {
            let body = '';
            res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            res.on('end', () => {
              try { resolve(JSON.parse(body).status === 'ok'); } catch { resolve(false); }
            });
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => { req.destroy(); resolve(false); });
        });
      } catch {}
      if (healthy) {
        mainWindow?.webContents.send('cloud:status', { connected: true, healthy: true });
        console.log('[Cloud] Auto-connected to cloud server successfully');

        // Auto-pull memories from cloud on successful connection for cross-device sync
        if (cloudClient) {
          cloudClient.listMemories().then(async (cloudMemories) => {
            if (!Array.isArray(cloudMemories) || cloudMemories.length === 0) return;
            try {
              const db = getDatabase();
              let count = 0;
              for (const cm of cloudMemories) {
                await saveMemoryWithDedup(db, saveDatabase, {
                  scope: (cm.scope === 'global' ? 'global' : 'project') as 'global' | 'project',
                  projectPath: cm.scope !== 'global' ? (cm as any).project_path || null : null,
                  category: cm.category || 'knowledge',
                  title: cm.title,
                  content: cm.content,
                  source: 'automatic',
                });
                count++;
              }
              console.log(`[Cloud] Auto-pulled ${count} memories from cloud on startup`);
            } catch (e) {
              console.warn('[Cloud] Auto-pull memories failed:', e);
            }
          }).catch(() => {});
        }

        return true;
      } else {
        // WebSocket might still connect later via its own reconnect logic
        console.log('[Cloud] WebSocket connecting, health check pending...');
        return true; // Don't retry — WebSocket will handle reconnection
      }
    } catch (err) {
      console.log('[Cloud] Auto-connect failed:', (err as Error).message);
      return false;
    }
  };

  // Start persistent retry loop
  const startRetryLoop = () => {
    if (cloudRetryTimer) clearInterval(cloudRetryTimer);
    cloudRetryTimer = setInterval(async () => {
      // Check if we should retry
      if (cloudClient) {
        try {
          const healthy = await cloudClient.healthCheck().catch(() => false);
          if (healthy) {
            console.log('[Cloud] Retry check: already connected, stopping retry timer');
            if (cloudRetryTimer) { clearInterval(cloudRetryTimer); cloudRetryTimer = null; }
            return;
          }
        } catch {}
      }
      console.log('[Cloud] Periodic retry: attempting reconnect...');
      const ok = await tryConnect();
      if (ok && cloudRetryTimer) {
        // Verify connection is stable before stopping timer
        try {
          const healthy = await cloudClient?.healthCheck().catch(() => false);
          if (healthy) {
            console.log('[Cloud] Periodic retry succeeded, stopping timer');
            clearInterval(cloudRetryTimer);
            cloudRetryTimer = null;
          }
        } catch {}
      }
    }, 60000); // Retry every 60 seconds
  };

  // First attempt immediately
  const connected = await tryConnect();
  if (!connected) {
    console.log('[Cloud] Initial connect failed, starting persistent retry loop');
    startRetryLoop();
  }
  isConnecting = false;

  // Also schedule quick retries at 10s and 30s before falling back to 60s interval
  setTimeout(async () => {
    if (cloudRetryTimer) {
      // Still not connected after 10s, try again
      console.log('[Cloud] Quick retry at 10s');
      await tryConnect();
    }
  }, 10000);

  setTimeout(async () => {
    if (cloudRetryTimer) {
      // Still not connected after 40s, try again
      console.log('[Cloud] Quick retry at 40s');
      const ok = await tryConnect();
      if (ok && cloudRetryTimer) {
        clearInterval(cloudRetryTimer);
        cloudRetryTimer = null;
      }
    }
  }, 40000);
}

/** Push a memory to cloud when created locally */
export async function pushMemoryToCloud(memory: {
  title: string; content: string; category?: string; scope?: 'global' | 'project';
}): Promise<void> {
  if (!cloudClient) {
    console.log('[Cloud] Skipped memory push (not connected)');
    return;
  }
  try {
    await cloudClient.upsertMemory(memory);
    console.log('[Cloud] Memory pushed successfully:', memory.title);
  } catch (err) {
    console.warn('[Cloud] Failed to push memory to cloud:', (err as Error).message);
  }
}

/** Push a conversation session to cloud when saved */
export async function pushSessionToCloud(session: {
  id: string; title?: string; messages?: any[]; metadata?: any;
}): Promise<void> {
  if (!cloudClient) {
    console.log('[Cloud] Skipped session push (not connected):', session.title);
    return;
  }
  try {
    await cloudClient.upsertSession(session);
    console.log('[Cloud] Session pushed successfully:', session.title);
  } catch (err) {
    console.warn('[Cloud] Failed to push session to cloud:', (err as Error).message);
  }
}

export function getCloudClient(): CloudSyncClient | null {
  return cloudClient;
}
