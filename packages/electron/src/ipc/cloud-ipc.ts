// 灵境 Cloud IPC - 云端会话同步 & 记忆同步
// Bridges Electron IPC <-> CloudSyncClient

import { ipcMain, BrowserWindow, app } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { CloudSyncClient } from '@codepilot/core';
// CloudSyncOptions type - defined locally as core dist is outdated
interface CloudSyncOptions {
  url?: string;
  apiKey?: string;
  deviceId?: string;
}
// Use console for logging since @codepilot/core logger has compatibility issues with esbuild bundling
const logger = console;

let cloudClient: CloudSyncClient | null = null;
let mainWindow: BrowserWindow | null = null;
let cloudRetryTimer: ReturnType<typeof setInterval> | null = null;
let isConnecting = false; // Prevents dual client creation during manual connect
let isAutoConnecting = false; // Separate flag for auto-connect (Bug 4 fix)

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

function setupCloudEventListeners(client: CloudSyncClient, win: BrowserWindow): void {
  client.removeAllListeners();
  client.on('connected', (data) => {
    if (!win.isDestroyed()) win.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: client.getDeviceId() });
  });
  client.on('disconnected', () => {
    if (!win.isDestroyed()) win.webContents.send('cloud:status', { connected: false });
  });
  client.on('sync', (payload) => {
    if (!win.isDestroyed()) win.webContents.send('cloud:sync-event', payload);
  });
  client.on('webhook', (data) => {
    if (!win.isDestroyed()) win.webContents.send('cloud:webhook-event', data);
  });
  client.on('relay:from-mobile', (data) => {
    if (!win.isDestroyed()) win.webContents.send('cloud:relay:from-mobile', data);
  });
  client.on('desktop:list', (data) => {
    if (!win.isDestroyed()) win.webContents.send('cloud:desktop:list', data);
  });
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
      // Use passed API key (falls back to CloudSyncClient default)
      const connectOpts = opts || {};
      cloudClient = new CloudSyncClient(connectOpts);

      // Auto-register for JWT
      const registered = await cloudClient.autoRegister();
      if (!registered) {
        console.warn('[Cloud] autoRegister failed, will still try WebSocket');
      }

      setupCloudEventListeners(cloudClient, win);

      // Connect WebSocket
      cloudClient.connectWebSocket();

      // Wait for WebSocket connection to be established
      let wsTimeout: ReturnType<typeof setTimeout> | null = null;
      const wsConnected = await Promise.race([
        new Promise<boolean>(resolve => {
          cloudClient!.once('connected', () => resolve(true));
        }),
        new Promise<boolean>((resolve) => {
          wsTimeout = setTimeout(() => resolve(false), 10000);
        }),
      ]);
      if (wsTimeout) clearTimeout(wsTimeout);

      let healthy = false;
      if (wsConnected) {
        healthy = await cloudClient.healthCheck().catch(e => {
          console.warn('[Cloud] healthCheck failed after WS connected:', e);
          return false;
        });
      } else {
        console.warn('[Cloud] WebSocket did not connect within timeout');
      }
      isConnecting = false;
      const isConnected = wsConnected && healthy;
      // Notify renderer if connection failed (Bug 1 fix)
      if (!isConnected) {
        win.webContents.send('cloud:status', { connected: false, healthy: false, error: wsConnected ? 'healthCheck failed' : 'WebSocket connection timeout' });
      }
      return { connected: isConnected, healthy, wsConnected, registered, deviceId: cloudClient.getDeviceId() };
    } catch (err) {
      isConnecting = false;
      console.error('[Cloud] cloud:connect failed:', err instanceof Error ? (err.stack || err.message) : String(err));
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
    // Check actual WebSocket readyState (Bug 2+5 fix)
    const ws = (cloudClient as any).ws as WebSocket | null;
    const wsOpen = ws !== null && ws.readyState === WebSocket.OPEN;
    if (!wsOpen) {
      return { connected: false, healthy: false, error: 'WebSocket not open (readyState=' + (ws?.readyState ?? -1) + ')' };
    }
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
    return { connected: wsOpen && healthy, healthy };
  });

  /** Set user JWT token on the sync client (after cloud account login) */
  ipcMain.handle('cloud:set-user-token', async (_event, token: string) => {
    if (!cloudClient) {
      const savedConfig = loadCloudConfig();
      const opts: Record<string, string> = {};
      if (savedConfig?.url) opts.url = savedConfig.url;
      if (savedConfig?.apiKey) opts.apiKey = savedConfig.apiKey;
      cloudClient = new CloudSyncClient(Object.keys(opts).length > 0 ? opts : {});
      await cloudClient.autoRegister().catch((err) => { console.warn('[Cloud] autoRegister in set-user-token failed:', err); });
    }

    setupCloudEventListeners(cloudClient, win);

    cloudClient.setToken(token);
    logger.info('[Cloud] User JWT bound to sync client');

    // Wait for WebSocket to connect (max 10s)
    let wsTimeout2: ReturnType<typeof setTimeout> | null = null;
    const wsConnected = await Promise.race([
      new Promise<boolean>(resolve => {
        cloudClient!.once("connected", () => resolve(true));
      }),
      new Promise<boolean>(resolve => {
        wsTimeout2 = setTimeout(() => resolve(false), 10000);
      }),
    ]);
    if (wsTimeout2) clearTimeout(wsTimeout2);

    const healthy = wsConnected ? await cloudClient!.healthCheck().catch(() => false) : false;
    return { ok: true, connected: wsConnected, healthy, deviceId: cloudClient!.getDeviceId() };
  });

  // ── HTTP Proxy API (bypass CORS for renderer fetch) ──

  ipcMain.handle('cloud:proxy-api', async (_event, opts: {
    endpoint: string;
    method?: string;
    body?: unknown;
    token?: string;
    baseUrl?: string;
  }) => {
    const allowedEndpoints = /^\/(sessions|memories|webhook|auth|health|devices|subscriptions|version)/;
    if (!allowedEndpoints.test(opts.endpoint)) {
      return { error: `Endpoint not allowed: ${opts.endpoint}` };
    }
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
    id?: string; title: string; content: string; category?: string; scope?: string;
  }) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.upsertMemory(memory as any);
  });

  ipcMain.handle('cloud:memories:delete', async (_event, id: string) => {
    if (!cloudClient) throw new Error('Cloud not connected');
    return cloudClient.deleteMemory(id);
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

  ipcMain.handle('cloud:push-memory', async (_event, memory: {
    title: string; content: string; category?: string; scope?: string;
  }) => {
    await pushMemoryToCloud(memory);
    return { ok: true };
  });
}

/** Auto-connect to cloud on app start (if configured). Retries persistently. */
export async function autoConnectCloud(): Promise<void> {
  // Prevent dual auto-connect attempts (Bug 4 fix: separate flag from manual connect)
  if (isAutoConnecting) {
    console.log('[Cloud] Already auto-connecting, skipping');
    return;
  }
  isAutoConnecting = true;

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

      // Read persisted config (URL + apiKey)
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

      setupCloudEventListeners(cloudClient, win);

      cloudClient.connectWebSocket();

      // Wait for WebSocket connected event (max 5s) instead of hardcoded sleep
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => resolve(), 5000);
        cloudClient!.once('connected', () => { clearTimeout(timer); resolve(); });
      });

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
      } catch (err) {
        console.warn('[Cloud] Health check error:', err instanceof Error ? err.message : String(err));
      }
      if (healthy) {
        mainWindow?.webContents.send('cloud:status', { connected: true, healthy: true });
        console.log('[Cloud] Auto-connected to cloud server successfully');
        return true;
      } else {
        // WebSocket connected but health check failed — meaningful failure, should retry
        console.log('[Cloud] WebSocket connected but health check failed');
        mainWindow?.webContents.send('cloud:status', { connected: false, healthy: false, error: 'healthCheck failed' });
        return false; // Will trigger retry loop
      }
    } catch (err) {
      console.log('[Cloud] Auto-connect failed:', (err as Error).message);
      // Notify renderer that connection failed
      mainWindow?.webContents.send('cloud:status', { connected: false, healthy: false, error: 'Auto-connect failed: ' + (err as Error).message });
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
  isAutoConnecting = false;

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
  title: string; content: string; category?: string; scope?: string;
}): Promise<void> {
  if (!cloudClient) {
    console.log('[Cloud] Skipped memory push (not connected)');
    return;
  }
  try {
    await cloudClient.upsertMemory(memory as any);
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
