// 灵境 Cloud IPC - 云端会话同步 & 记忆同步
// Bridges Electron IPC <-> CloudSyncClient

import { ipcMain, BrowserWindow, app } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CloudSyncClient, type CloudSyncOptions } from '@codepilot/core';
// @ts-ignore
import { logger } from './agent-ipc.js';

let cloudClient: CloudSyncClient | null = null;
let mainWindow: BrowserWindow | null = null;
let cloudRetryTimer: ReturnType<typeof setInterval> | null = null;

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

      const healthy = await cloudClient.healthCheck().catch(e => {
        console.warn('[Cloud] healthCheck failed after WS connected:', e);
        return true; // WS connected, consider it healthy even if HTTP health check fails
      });
      return { connected: true, healthy, wsConnected, registered, deviceId: cloudClient.getDeviceId() };
    } catch (err) {
      return { connected: false, error: String(err) };
    }
  });

  ipcMain.handle('cloud:disconnect', async () => {
    if (cloudRetryTimer) { clearInterval(cloudRetryTimer); cloudRetryTimer = null; }
    if (cloudClient) {
      cloudClient.disconnect();
      cloudClient = null;
    }
    return { ok: true };
  });

  ipcMain.handle('cloud:status', async () => {
    if (!cloudClient) return { connected: false, healthy: false };
    const healthy = await cloudClient.healthCheck().catch(() => false);
    return { connected: true, healthy };
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
    return cloudClient.upsertMemory(memory);
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

      // Wait briefly for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check health to confirm connectivity
      const healthy = await cloudClient.healthCheck().catch(() => false);
      if (healthy) {
        mainWindow?.webContents.send('cloud:status', { connected: true, healthy: true });
        console.log('[Cloud] Auto-connected to cloud server successfully');
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
