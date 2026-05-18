// 灵境IDE 移动端 - API 服务层
// 合并 lingjing-mobile/api.ts + mobile/cloud.ts 全部功能
// 支持 LAN 直连 + Cloud 中转 + 设备自动注册 + 定时任务 + Webhook
// v1.40.0: 添加 SHA-256 密码哈希 + 心跳保活 + 云账号持久化

import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

/** SHA-256 hex digest for password hashing */
async function sha256(data: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

export interface ApiConfig {
  baseUrl: string;       // LAN: http://192.168.1.x:3001  Cloud: https://ide.zhejiangjinmo.com
  token: string;
  wsUrl: string;         // LAN: ws://192.168.1.x:3001/ws  Cloud: wss://...
  apiKey?: string;       // 可选 API Key 认证
}

interface WsRequest {
  type: 'cmd';
  id: string;
  channel: 'chat' | 'quest' | 'plan' | 'memory' | 'status' | 'file';
  action: 'list' | 'get' | 'send' | 'subscribe' | 'unsubscribe';
  payload: Record<string, any>;
}

interface WsResponse {
  type: 'ack' | 'push' | 'pong' | 'error';
  id?: string;
  success?: boolean;
  data?: any;
  error?: string;
  channel?: string;
  event?: string;
}

type WsCallback = (data: WsResponse) => void;

class ApiService {
  private config: ApiConfig = { baseUrl: '', token: '', wsUrl: '' };
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<string, WsCallback> = new Map();
  private wsSubscriptions: Set<string> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  public onConnectionChange?: (connected: boolean) => void;

  // ── CLOUD ACCOUNT STATE ──
  private _deviceId: string | null = null;
  private _jwtToken: string | null = null;
  private _cloudUser: { id: string; username: string; email: string } | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _cloudApiBase = 'https://ide.zhejiangjinmo.com/api';

  // Storage keys for persistence
  private static STORAGE_KEYS = {
    CLOUD_TOKEN: 'cloudAccountToken',
    CLOUD_USER: 'cloudAccountUser',
    CLOUD_DEVICE_ID: 'cloudAccountDeviceId',
  } as const;

  get deviceId(): string | null { return this._deviceId; }
  get jwtToken(): string | null { return this._jwtToken; }
  get cloudUser(): { id: string; username: string; email: string } | null { return this._cloudUser; }
  get isCloudLoggedIn(): boolean { return !!this._jwtToken && !!this._cloudUser; }

  configure(config: Partial<ApiConfig>) {
    this.config = { ...this.config, ...config };
    // Update JWT token as well for backwards compat
    if (config.token) this._jwtToken = config.token;
  }

  getConfig(): ApiConfig {
    return { ...this.config };
  }

  // ── HTTP ──
  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this._jwtToken) {
      h['Authorization'] = `Bearer ${this._jwtToken}`;
    } else if (this.config.token) {
      h['Authorization'] = `Bearer ${this.config.token}`;
    } else if (this.config.apiKey) {
      h['x-api-key'] = this.config.apiKey;
    }
    return h;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const baseUrl = this.config.baseUrl || 'https://ide.zhejiangjinmo.com';
    const url = `${baseUrl}/api${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options?.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
    return data;
  }

  // ── CLOUD ACCOUNT AUTH (登录/注册) ──
  
  /** Login with cloud account (SHA-256 hashed password) */
  async login(username: string, password: string): Promise<any> {
    try {
      const hashed = await sha256(password);
      const result: any = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password: hashed }),
      });
      if (result.ok && result.token) {
        this._jwtToken = result.token;
        this.config.token = result.token;
        if (result.user) {
          this._cloudUser = { id: result.user.id, username: result.user.username, email: result.user.email };
          this._persistCloudSession();
          // Auto-register device on login
          this.registerDeviceToCloud().catch(() => {});
        }
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  async signup(username: string, password: string, email?: string): Promise<any> {
    try {
      const hashed = await sha256(password);
      const result: any = await this.request('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password: hashed, email }),
      });
      if (result.ok && result.token) {
        this._jwtToken = result.token;
        this.config.token = result.token;
        if (result.user) {
          this._cloudUser = { id: result.user.id, username: result.user.username, email: result.user.email };
          this._persistCloudSession();
          this.registerDeviceToCloud().catch(() => {});
        }
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  // ── CLOUD ACCOUNT MANAGEMENT (v1.40.0) ──

  /** Register this mobile device on the cloud (JWT /devices/register) */
  async registerDeviceToCloud(): Promise<any> {
    try {
      const deviceName = `Mobile - ${Platform.OS} ${Platform.Version || ''}`;
      const result: any = await this._cloudRequest('/devices/register', 'POST', {
        name: deviceName,
        type: 'mobile',
        os: Platform.OS,
        deviceId: this._deviceId || undefined,
      });
      if (result.id) {
        this._deviceId = result.id;
        this._persistCloudSession();
        this._startHeartbeat();
      }
      return result;
    } catch (err) {
      console.warn('[API] registerDeviceToCloud failed:', err instanceof Error ? err.message : String(err));
      return { ok: false };
    }
  }

  /** Start periodic heartbeat (every 60s) */
  private _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(async () => {
      if (!this._deviceId || !this._jwtToken) return;
      try {
        await this._cloudRequest('/devices/heartbeat', 'POST', { deviceId: this._deviceId });
      } catch { /* best-effort */ }
    }, 60000);
  }

  /** Stop heartbeat */
  private _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /** Send go-offline signal and logout */
  async cloudLogout(): Promise<void> {
    try {
      if (this._deviceId && this._jwtToken) {
        await this._cloudRequest('/devices/go-offline', 'PUT', { deviceId: this._deviceId });
      }
    } catch { /* best-effort */ }
    this._stopHeartbeat();
    this._jwtToken = null;
    this._cloudUser = null;
    this._deviceId = null;
    this.config.token = '';
    // Clear persisted session
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.multiRemove(Object.values(ApiService.STORAGE_KEYS));
    } catch { /* ignore */ }
  }

  /** Persist cloud session to AsyncStorage */
  private async _persistCloudSession() {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const pairs: [string, string][] = [];
      if (this._jwtToken) pairs.push([ApiService.STORAGE_KEYS.CLOUD_TOKEN, this._jwtToken]);
      if (this._cloudUser) pairs.push([ApiService.STORAGE_KEYS.CLOUD_USER, JSON.stringify(this._cloudUser)]);
      if (this._deviceId) pairs.push([ApiService.STORAGE_KEYS.CLOUD_DEVICE_ID, this._deviceId]);
      if (pairs.length) await AsyncStorage.multiSet(pairs);
    } catch { /* ignore */ }
  }

  /** Restore cloud session from AsyncStorage (call on app startup) */
  async restoreCloudSession(): Promise<boolean> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const values = await AsyncStorage.multiGet(Object.values(ApiService.STORAGE_KEYS));
      const map = new Map(values as [string, string | null][]);
      const token = map.get(ApiService.STORAGE_KEYS.CLOUD_TOKEN) || null;
      const userStr = map.get(ApiService.STORAGE_KEYS.CLOUD_USER) || null;
      const deviceId = map.get(ApiService.STORAGE_KEYS.CLOUD_DEVICE_ID) || null;
      
      if (token && userStr) {
        this._jwtToken = token;
        this.config.token = token;
        this._cloudUser = JSON.parse(userStr);
        this._deviceId = deviceId;
        // Re-register device and restart heartbeat
        this.registerDeviceToCloud().catch(() => {});
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Cloud API request (uses fixed cloud URL and JWT) */
  private async _cloudRequest<T>(path: string, method: string = 'POST', body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this._jwtToken) headers['Authorization'] = `Bearer ${this._jwtToken}`;
    const url = `${this._cloudApiBase}${path}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ── DEVICE REGISTRATION & AUTH (移植自 cloud.ts) ──
  async registerDevice(deviceName?: string): Promise<any> {
    const result: any = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: this._deviceId || undefined,
        deviceName: deviceName || `Mobile - ${Platform.OS}`,
        deviceInfo: { platform: Platform.OS, version: Platform.Version },
        apiKey: this.config.apiKey || undefined,
      }),
    });
    this._jwtToken = result.token;
    this._deviceId = result.deviceId;
    return result;
  }

  async verifyToken(): Promise<any> {
    if (!this._jwtToken && !this.config.token) throw new Error('Not authenticated');
    return this.request('/auth/verify');
  }

  // ── SESSIONS (对话) ──
  async getSessions(limit = 50) { return this.request<any>(`/sessions?limit=${limit}`); }
  async getSession(id: string) { return this.request<any>(`/sessions/${id}`); }
  async sendMessage(conversationId: string, message: string) {
    return this.request<any>(`/sessions/${conversationId}/send`, {
      method: 'POST', body: JSON.stringify({ message }),
    });
  }
  async upsertSession(session: { id: string; title?: string; messages?: any[]; metadata?: any }) {
    return this.request<any>('/sessions', {
      method: 'POST', body: JSON.stringify(session),
    });
  }
  async deleteSession(id: string) {
    return this.request<any>(`/sessions/${id}`, { method: 'DELETE' });
  }

  // ── PLANS (计划) ──
  async getPlans() { return this.request<any>('/plans'); }
  async getPlan(id: string) { return this.request<any>(`/plans/${id}`); }

  // ── QUESTS (任务) ──
  async getTasks() { return this.request<any>('/quest-tasks'); }
  async createQuest(message: string, scenario = 'spec') {
    return this.request<any>('/quest', {
      method: 'POST', body: JSON.stringify({ message, scenario }),
    });
  }

  // ── MEMORIES (记忆体) ──
  async getMemories() { return this.request<any>('/memories'); }
  async searchMemories(query?: string) {
    const qs = query ? `?action=search&query=${encodeURIComponent(query)}` : '';
    return this.request<any>(`/memories${qs}`);
  }
  async saveMemory(memory: { title: string; content: string; category?: string; scope?: string }) {
    return this.request<any>('/memories', {
      method: 'POST', body: JSON.stringify(memory),
    });
  }

  // ── SCHEDULES (定时任务 - 移植自 cloud.ts) ──
  async listSchedules(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<any>(`/schedules${qs}`);
  }
  async createSchedule(params: { name: string; cronExpr: string; actionType?: string; actionConfig?: any }) {
    return this.request<any>('/schedules', {
      method: 'POST', body: JSON.stringify(params),
    });
  }
  async deleteSchedule(id: string) {
    return this.request<any>(`/schedules/${id}`, { method: 'DELETE' });
  }
  async triggerSchedule(id: string) {
    return this.request<any>(`/schedules/${id}/trigger`, { method: 'POST' });
  }
  async getScheduleLogs(id: string) {
    return this.request<any>(`/schedules/${id}/logs`);
  }

  // ── WEBHOOK (移植自 cloud.ts) ──
  async triggerWebhook(channel: string, payload: any) {
    return this.request<any>(`/webhook/${encodeURIComponent(channel)}`, {
      method: 'POST', body: JSON.stringify(payload),
    });
  }

  // ── SUBSCRIPTION & PAYMENTS ──
  async getSubscription() { return this.request<any>('/subscription'); }
  async getPlans2() { return this.request<any>('/plans'); }

  // Payment
  async createPayment(channel: string, amount: number, planId: string) {
    return this.request<any>('/payments/create', {
      method: 'POST',
      body: JSON.stringify({ channel, amount, planId }),
    });
  }
  async confirmPayment(orderId: string) {
    return this.request<any>(`/payments/confirm/${orderId}`, { method: 'POST' });
  }
  async queryPayment(orderId: string) {
    return this.request<any>(`/payments/query/${orderId}`);
  }
  async getPayments(deviceId?: string) {
    const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    return this.request<any>(`/payments${qs}`);
  }

  // Subscription management (upgrade / downgrade / cancel)
  async subscribe(planId: string) {
    return this.request<any>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ planId, action: 'subscribe' }),
    });
  }
  async upgrade(planId: string) {
    return this.request<any>('/subscriptions/upgrade', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }
  async downgrade(planId: string) {
    return this.request<any>('/subscriptions/downgrade', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }
  async cancelSubscription() {
    return this.request<any>('/subscriptions/cancel', { method: 'POST' });
  }

  // Offline payment
  async submitOfflinePayment(params: { planId: string; amount: number; remark?: string }) {
    return this.request<any>('/payments/offline', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Invoices
  async getInvoices() { return this.request<any>('/payments/invoices'); }
  async createInvoice(params: { orderId: string; title?: string; taxId?: string }) {
    return this.request<any>('/payments/invoices', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ── DEVICE (设备管理) ──
  async getDevices() { return this.request<any>('/devices'); }
  async registerDeviceEndpoint(deviceInfo: { deviceId: string; name: string; type: string; os: string; version: string }) {
    return this.request<any>('/user/devices/register', {
      method: 'POST', body: JSON.stringify(deviceInfo),
    });
  }
  async heartbeat() {
    return this.request<any>('/user/devices/heartbeat', { method: 'PUT' });
  }

  // ── STATUS ──
  async getStatus() { return this.request<any>('/status'); }

  // ── WebSocket ──
  connectWs() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.disconnectWs();

    const token = this._jwtToken || this.config.token;
    const url = `${this.config.wsUrl}?token=${encodeURIComponent(token)}`;
    console.log('[Mobile API] Connecting WebSocket:', url.replace(token, '***'));
    
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      console.log('[Mobile API] WebSocket connected');
      this.onConnectionChange?.(true);
      this.wsSubscriptions.forEach(ch => this.wsSend({ type: 'cmd', id: `sub-${Date.now()}`, channel: ch as any, action: 'subscribe', payload: {} }));
    };
    this.ws.onmessage = (event) => {
      try {
        const msg: WsResponse = JSON.parse(event.data);
        if (msg.type === 'push') {
          this.wsCallbacks.forEach(cb => cb(msg));
        } else if (msg.id && this.wsCallbacks.has(msg.id)) {
          this.wsCallbacks.get(msg.id)!(msg);
          this.wsCallbacks.delete(msg.id);
        }
      } catch (e) { /* ignore parse errors */ }
    };
    this.ws.onclose = () => {
      console.log('[Mobile API] WebSocket disconnected');
      this.onConnectionChange?.(false);
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      console.log('[Mobile API] WebSocket error');
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWs();
    }, 3000);
  }

  disconnectWs() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
  }

  private wsSend(msg: WsRequest) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  wsCommand(channel: WsRequest['channel'], action: WsRequest['action'], payload: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.wsCallbacks.set(id, (resp) => {
        if (resp.success) resolve(resp.data);
        else reject(new Error(resp.error || 'Unknown error'));
      });
      this.wsSend({ type: 'cmd', id, channel, action, payload });
      setTimeout(() => {
        if (this.wsCallbacks.has(id)) {
          this.wsCallbacks.delete(id);
          reject(new Error('Timeout'));
        }
      }, 10000);
    });
  }

  subscribeWs(callback: WsCallback) {
    const key = `cb-${Date.now()}`;
    this.wsCallbacks.set(key, callback);
    return () => this.wsCallbacks.delete(key);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const api = new ApiService();
