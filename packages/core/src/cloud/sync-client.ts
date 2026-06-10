// Cloud sync client v2 - 灵境云端同步客户端
// Uses HTTP REST API + WebSocket + JWT auth for real-time cloud integration

import { OfflineQueue } from './offline-queue.js';
import type {
  CloudSession,
  CloudMemory,
  CloudSyncEvent,
} from './types.js';

const DEFAULT_SERVER = 'https://lingjing.zhejiangjinmo.com';
// SECURITY: API key must be provided by the user/environment.
// Previously hardcoded key removed to prevent unauthorized cloud access.
const DEFAULT_API_KEY = '';

export interface CloudSyncClientOptions {
  url?: string;
  apiKey?: string;
  enabled?: boolean;
  deviceId?: string;
  deviceName?: string;
}

type EventListener = (data: any) => void;

function generateDeviceId(): string {
  const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return hex;
}

export class CloudSyncClient {
  url: string;
  apiKey: string;
  enabled: boolean;
  token: string | null = null;
  deviceId: string;
  deviceName: string;
  ws: WebSocket | null = null;
  wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Heartbeat timer: sends ping every 30s to keep WebSocket alive */
  _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  syncTimer: ReturnType<typeof setInterval> | null = null;
  listeners: Map<string, Set<EventListener>> = new Map();
  queue: OfflineQueue;
  private _online = false;
  /** Reconnection backoff state */
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 10;

  constructor(options: CloudSyncClientOptions = {}) {
    this.url = (options.url || DEFAULT_SERVER).replace(/\/$/, '');
    this.apiKey = options.apiKey || DEFAULT_API_KEY;
    this.enabled = options.enabled !== false;
    this.deviceId = options.deviceId || generateDeviceId();
    this.deviceName = options.deviceName || `LingJing-${typeof process !== 'undefined' ? process.platform : 'web'}-${this.deviceId.slice(0, 6)}`;

    this.queue = new OfflineQueue({
      onFlush: async (items) => {
        for (const item of items) {
          try {
            switch (item.type) {
              case 'session':
                if (item.action === 'upsert') {
                  await this._directRequest('POST', '/sessions', item.payload);
                } else if (item.action === 'delete') {
                  await this._directRequest('DELETE', `/sessions/${encodeURIComponent(item.payload.id)}`);
                }
                break;
              case 'memory':
                if (item.action === 'upsert') {
                  await this._directRequest('POST', '/memories', item.payload);
                } else if (item.action === 'delete') {
                  await this._directRequest('DELETE', `/memories/${encodeURIComponent(item.payload.id)}`);
                }
                break;
              case 'webhook':
                if (item.action === 'trigger') {
                  await this._directRequest('POST', `/webhook/${encodeURIComponent(item.payload.channel)}`, item.payload.payload);
                }
                break;
            }
            this.queue.ack(item.id);
          } catch (err) {
            this.queue.nack(item.id, err instanceof Error ? err : new Error(String(err)));
          }
        }
      },
      onError: (item, error) => {
        console.warn(`[CloudSync] Queue item ${item.id} failed (retry ${item.retries}/${item.maxRetries}):`, error.message);
      },
    });
    this.queue.startPeriodicFlush(5000);
  }

  // ── Auth ──

  /** Auto-register device and get JWT token */
  async autoRegister(): Promise<boolean> {
    if (this.token) return true;
    try {
      const res = await fetch(`${this.url}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          deviceInfo: {
            platform: typeof process !== 'undefined' ? process.platform : 'web',
            arch: typeof process !== 'undefined' ? process.arch : 'unknown',
            nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
            clientVersion: '2.0.0',
          },
          apiKey: this.apiKey,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown');
        console.warn(`[CloudSync] Register failed: ${res.status} ${text}`);
        return false;
      }
      const data = await res.json();
      if (data.token) {
        this.token = data.token;
        console.info(`[CloudSync] Device registered: ${this.deviceName} (${this.deviceId})`);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[CloudSync] Register error:`, err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  // ── HTTP Helpers ──

  authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    } else {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }

  /** Direct request without queue */
  async _directRequest(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.url}/api${path}`, {
      method,
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown');
      throw new Error(`Cloud API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async request(method: string, path: string, body?: any): Promise<any> {
    return this._directRequest(method, path, body);
  }

  // ── Token Management ──

  /** Set a user JWT token directly (overrides device registration token) */
  setToken(token: string): void {
    this.token = token;
    console.info(`[CloudSync] User token set (${token.slice(0, 12)}...)`);
    // Reconnect WebSocket with new token
    this.disconnectWebSocket();
    this.connectWebSocket();
  }

  /** Clear token (fall back to device registration) */
  clearToken(): void {
    this.token = null;
    this.disconnectWebSocket();
  }

  // ── Device Info ──

  getDeviceId(): string { return this.deviceId; }
  getDeviceName(): string { return this.deviceName; }
  hasToken(): boolean { return !!this.token; }

  // ── Sessions ──

  async listSessions(): Promise<CloudSession[]> {
    return this.request('GET', '/sessions');
  }

  async getSession(id: string): Promise<CloudSession> {
    return this.request('GET', `/sessions/${encodeURIComponent(id)}`);
  }

  async upsertSession(session: Partial<CloudSession>): Promise<CloudSession> {
    return this.request('POST', '/sessions', session);
  }

  async deleteSession(id: string): Promise<void> {
    await this.request('DELETE', `/sessions/${encodeURIComponent(id)}`);
  }

  // ── Memories ──

  async listMemories(query?: string): Promise<CloudMemory[]> {
    const qs = query ? `?action=search&query=${encodeURIComponent(query)}` : '';
    return this.request('GET', `/memories${qs}`);
  }

  async upsertMemory(memory: Partial<CloudMemory>): Promise<CloudMemory> {
    return this.request('POST', '/memories', memory);
  }

  async deleteMemory(id: string): Promise<void> {
    await this.request('DELETE', `/memories/${encodeURIComponent(id)}`);
  }

  // ── Webhooks ──

  async triggerWebhook(channel: string, payload: any): Promise<any> {
    return this.request('POST', `/webhook/${encodeURIComponent(channel)}`, payload);
  }

  async getWebhookLogs(channel: string): Promise<any> {
    return this.request('GET', `/webhook/${encodeURIComponent(channel)}`);
  }

  // ── Health ──

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/api/health`);
      const data = await res.json();
      return data?.status === 'ok';
    } catch {
      return false;
    }
  }

  // ── WebSocket ──

  /** Start heartbeat: sends ping every 30s to keep WebSocket alive */
  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Connection might have dropped; heartbeat will stop on onclose
        }
      }
    }, 30000);
  }

  /** Stop heartbeat timer */
  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  connectWebSocket(): void {
    if (!this.enabled || this.ws) return;
    const authParam = this.token
      ? `token=${encodeURIComponent(this.token)}`
      : `api_key=${encodeURIComponent(this.apiKey)}`;
    const wsUrl = this.url.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws?' + authParam;

    // Browser has global WebSocket; Node.js needs 'ws' package
    const WS: typeof WebSocket = (typeof WebSocket !== 'undefined' ? WebSocket : require('ws'));
    this.ws = new WS(wsUrl) as WebSocket;
    this.ws.onopen = () => {
      console.info('[CloudSync] WebSocket connected');
      this._reconnectAttempts = 0;  // Reset backoff on successful connection
      this._startHeartbeat();
      this._sendRaw({ type: 'desktop:register', deviceId: this.deviceId });
      this.emit('connected', { url: this.url, deviceId: this.deviceId });
    };
    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'pong') return;
        if (data.type === 'sync') {
          this.emit('sync', data.payload);
        } else if (data.type === 'webhook') {
          this.emit('webhook', data);
        } else if (data.type === 'relay:from-mobile') {
          this.emit('relay:from-mobile', data);
        } else if (data.type === 'relay:from-desktop') {
          this.emit('relay:from-desktop', data);
        }
      } catch { /* ignore */ }
    };
    this.ws.onclose = () => {
      this._stopHeartbeat();
      this.ws = null;
      this.emit('disconnected', {});
      this.scheduleReconnect();
    };
    this.ws.onerror = (err: any) => {
      console.warn('[CloudSync] WebSocket error:', err?.message || err);
    };
  }

  scheduleReconnect(): void {
    if (this.wsReconnectTimer) return;
    this._reconnectAttempts++;
    if (this._reconnectAttempts > this._maxReconnectAttempts) {
      console.warn(`[CloudSync] Max reconnect attempts (${this._maxReconnectAttempts}) reached, giving up`);
      return;
    }
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s (=~8.5min)
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 60000);
    console.info(`[CloudSync] Reconnecting in ${delay / 1000}s (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`);
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  /** Send raw JSON to WebSocket (safe wrapper) */
  private _sendRaw(data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(data)); } catch { /* ignore */ }
    }
  }

  /** Send a relay message (desktop → cloud → mobile or vice versa) */
  sendRelayMessage(type: string, payload: any, correlationId?: string): void {
    this._sendRaw({ type, payload, correlationId, deviceId: this.deviceId });
  }

  disconnectWebSocket(): void {
    this._stopHeartbeat();
    this._reconnectAttempts = 0;  // Reset for next explicit connect
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ── Offline Queue ──

  queueOperation(type: string, action: string, payload: any): string {
    return this.queue.enqueue(type, action, payload);
  }

  getQueueStats(): { total: number; pending: number; failed: number; oldestMs: number | null } {
    return this.queue.getStats();
  }

  async flushQueue(): Promise<{ succeeded: number; failed: number }> {
    return this.queue.flush();
  }

  async isOnline(): Promise<boolean> {
    return this.healthCheck();
  }

  // ── Event System ──

  on(event: string, fn: EventListener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: EventListener): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(fn => {
      try { fn(data); } catch { /* ignore */ }
    });
  }

  // ── Lifecycle ──

  disconnect(): void {
    this.disconnectWebSocket();
    this.queue.stopPeriodicFlush();
    this._stopHeartbeat();
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}
