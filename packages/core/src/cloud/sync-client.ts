// Cloud sync client v2 - 灵境云端同步客户端
// Uses HTTP REST API + WebSocket + JWT auth for real-time cloud integration

import { OfflineQueue } from './offline-queue.js';
import type {
  CloudSession,
  CloudMemory,
  CloudSyncEvent,
} from './types.js';

const DEFAULT_SERVER = 'https://ide.zhejiangjinmo.com';
const DEFAULT_API_KEY = process.env.LINGJING_API_KEY || 'lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8';

export interface CloudSyncClientOptions {
  url?: string;
  apiKey?: string;
  enabled?: boolean;
  deviceId?: string;
  deviceName?: string;
  userId?: string;
  isDesktop?: boolean;
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
  userId: string | null;
  isDesktop: boolean;
  ws: WebSocket | null = null;
  wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  _desktopHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  listeners: Map<string, Set<EventListener>> = new Map();
  queue: OfflineQueue;
  private _autoRegisterRetries = 0;
  private _maxAutoRegisterRetries = 3;

  constructor(options: CloudSyncClientOptions = {}) {
    this.url = (options.url || DEFAULT_SERVER).replace(/\/$/, '');
    this.apiKey = options.apiKey || DEFAULT_API_KEY;
    this.enabled = options.enabled !== false;
    this.deviceId = options.deviceId || generateDeviceId();
    this.deviceName = options.deviceName || `LingJing-${typeof process !== 'undefined' ? process.platform : 'web'}-${this.deviceId.slice(0, 6)}`;
    this.userId = options.userId || null;
    this.isDesktop = options.isDesktop !== false && (typeof process !== 'undefined' && !!process.platform);

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
            throw err;
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
        return this._retryAutoRegister();
      }
      const data = await res.json();
      if (data.token) {
        this.token = data.token;
        this._autoRegisterRetries = 0;
        console.info(`[CloudSync] Device registered: ${this.deviceName} (${this.deviceId})`);
        return true;
      }
      return this._retryAutoRegister();
    } catch (err) {
      console.warn(`[CloudSync] Register error:`, err instanceof Error ? err.message : String(err));
      return this._retryAutoRegister();
    }
  }

  private _retryAutoRegister(): boolean {
    if (this._autoRegisterRetries < this._maxAutoRegisterRetries) {
      this._autoRegisterRetries++;
      const delay = Math.min(1000 * Math.pow(2, this._autoRegisterRetries), 10000);
      console.info(`[CloudSync] Will retry autoRegister in ${delay}ms (attempt ${this._autoRegisterRetries})`);
      setTimeout(() => this.autoRegister(), delay);
    }
    return false;
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

  setToken(token: string): void {
    this.token = token;
    console.info(`[CloudSync] User token set (${token.slice(0, 12)}...)`);
    this.disconnectWebSocket();
    this.connectWebSocket();
  }

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

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.url}/api/health`);
      const data = await res.json();
      return { ok: data?.status === 'ok' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── WebSocket ──

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

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _startDesktopHeartbeat(): void {
    this._stopDesktopHeartbeat();
    this._desktopHeartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'desktop:heartbeat' }));
        } catch { /* ignore */ }
      }
    }, 60000);
  }

  private _stopDesktopHeartbeat(): void {
    if (this._desktopHeartbeatTimer) {
      clearInterval(this._desktopHeartbeatTimer);
      this._desktopHeartbeatTimer = null;
    }
  }

  connectWebSocket(): void {
    if (!this.enabled || this.ws) return;
    let authParam: string;
    if (this.token) {
      authParam = `token=${encodeURIComponent(this.token)}`;
      if (this.deviceId) authParam += `&device_id=${encodeURIComponent(this.deviceId)}`;
    } else {
      authParam = `api_key=${encodeURIComponent(this.apiKey)}`;
    }
    const wsUrl = this.url.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws?' + authParam;

    let WS: typeof WebSocket;
    try {
      WS = (typeof WebSocket !== 'undefined' ? WebSocket : require('ws'));
    } catch (err) {
      console.error('[CloudSync] Cannot load WebSocket implementation:', err instanceof Error ? err.message : String(err));
      this.scheduleReconnect();
      return;
    }

    const ws = new WS(wsUrl) as WebSocket;
    this.ws = ws;

    ws.onopen = () => {
      console.info('[CloudSync] WebSocket connected');
      this._startHeartbeat();

      if (this.isDesktop && this.deviceId) {
        try {
          ws.send(JSON.stringify({ type: 'desktop:register', deviceId: this.deviceId }));
          console.info(`[CloudSync] Sent desktop:register (deviceId=${this.deviceId.slice(0, 12)}...)`);
        } catch (err) {
          console.warn('[CloudSync] desktop:register send failed:', err instanceof Error ? err.message : String(err));
        }
        this._startDesktopHeartbeat();
      }

      this.emit('connected', { url: this.url, deviceId: this.deviceId });
    };
    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'pong') return;
        if (data.type === 'desktop:registered') {
          console.info('[CloudSync] Desktop relay registered:', data.ok ? 'success' : data.error);
          return;
        }
        if (data.type === 'desktop:heartbeat:ack') return;
        if (data.type === 'desktop:list') {
          this.emit('desktop:list', data);
          return;
        }
        if (data.type === 'relay:from-mobile') {
          console.info('[CloudSync] Relay from mobile:', data.payload?.type || 'message');
          this.emit('relay:from-mobile', data);
          return;
        }
        if (data.type === 'relay:from-desktop') {
          this.emit('relay:from-desktop', data);
          return;
        }
        if (data.type === 'relay:ack') {
          this.emit('relay:ack', data);
          return;
        }
        if (data.type === 'sync') {
          this.emit('sync', data.payload);
        } else if (data.type === 'webhook') {
          this.emit('webhook', data);
        } else {
          console.warn('[CloudSync] Unknown WS message type:', data.type);
        }
      } catch (err) {
        console.warn('[CloudSync] WS message parse error:', err instanceof Error ? err.message : String(err));
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this._stopHeartbeat();
      this._stopDesktopHeartbeat();
      this.ws = null;
      this.emit('disconnected', {});
      this.scheduleReconnect();
    };
    ws.onerror = (err: any) => {
      console.warn('[CloudSync] WebSocket error:', err?.message || err);
      this.emit('error', err);
    };
  }

  scheduleReconnect(): void {
    if (this.wsReconnectTimer) return;
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connectWebSocket();
    }, 5000);
  }

  disconnectWebSocket(): void {
    this._stopHeartbeat();
    this._stopDesktopHeartbeat();
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      const ws = this.ws;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
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
    const result = await this.healthCheck();
    return result.ok;
  }

  // ── Desktop Relay ──

  listDesktops(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ type: 'desktop:list' })); } catch { /* ws closed */ }
    }
  }

  sendRelayToMobile(payload: any, correlationId?: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'relay:to-mobile',
          deviceId: this.deviceId,
          payload,
          correlationId: correlationId || `relay-${Date.now()}`,
          timestamp: new Date().toISOString(),
        }));
      } catch { /* ws closed */ }
    }
  }

  sendRelayToDesktop(targetDeviceId: string, payload: any, correlationId?: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'relay:to-desktop',
          targetDeviceId,
          payload,
          correlationId: correlationId || `relay-${Date.now()}`,
          timestamp: new Date().toISOString(),
        }));
      } catch { /* ws closed */ }
    }
  }

  // ── Event System ──

  on(event: string, fn: EventListener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: EventListener): void {
    this.listeners.get(event)?.delete(fn);
  }

  once(event: string, fn: EventListener): void {
    const wrapper = (data: any) => {
      this.off(event, wrapper);
      fn(data);
    };
    this.on(event, wrapper);
  }

  emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(fn => {
      try { fn(data); } catch (err) {
        console.warn(`[CloudSync] Listener error on "${event}":`, err instanceof Error ? err.message : String(err));
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  // ── Lifecycle ──

  disconnect(): void {
    this.disconnectWebSocket();
    this.queue.stopPeriodicFlush();
    this._stopHeartbeat();
    this._stopDesktopHeartbeat();
    this.removeAllListeners();
  }
}
