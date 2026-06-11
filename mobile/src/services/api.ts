// LingJing IDE Mobile - API Service Layer
import { Platform } from 'react-native';

export interface ApiConfig {
 baseUrl: string;
 token: string;
 wsUrl: string;
 apiKey?: string;
}

interface WsRequest {
 type: 'cmd';
 id: string;
 channel: 'chat'|'quest'|'plan'|'memory'|'status'|'file';
 action: 'list'|'get'|'send'|'subscribe'|'unsubscribe';
 payload: Record<string, any>;
}

interface WsResponse {
 type: 'ack'|'push'|'pong'|'error';
 id?: string; success?: boolean; data?: any; error?: string; channel?: string; event?: string;
}

type WsCallback = (data: WsResponse) => void;


class ApiService {
 private config: ApiConfig = { baseUrl: '', token: '', wsUrl: '' };
 private ws: WebSocket|null = null;
 private wsCallbacks: Map<string, Function> = new Map();
 private wsSubscriptions: Set<string> = new Set();
 private reconnectTimer: ReturnType<typeof setTimeout>|null = null;
 private heartbeatTimer: ReturnType<typeof setInterval>|null = null;
 private wsReconnectAttempt = 0;
 private wsMaxReconnectDelay = 30000;
 public onConnectionChange?: (connected: boolean) => void;
 private _deviceId: string|null = null;
 private _jwtToken: string|null = null;
 private _cloudUser: any = null;
 get deviceId(): string|null { return this._deviceId; }
 get jwtToken(): string|null { return this._jwtToken; }
 get cloudUser(): any { return this._cloudUser; }
 configure(config: Partial<ApiConfig>) { this.config = { ...this.config, ...config }; if (config.token) this._jwtToken = config.token; }
 getConfig(): ApiConfig { return { ...this.config }; }
 private get headers(): Record<string, string> {
 const h: Record<string, string> = { 'Content-Type': 'application/json' };
 if (this._jwtToken) h['Authorization'] = 'Bearer ' + this._jwtToken;
 else if (this.config.token) h['Authorization'] = 'Bearer ' + this.config.token;
 else if (this.config.apiKey) h['x-api-key'] = this.config.apiKey;
 return h;
 }
 private async request<T>(path: string, options?: RequestInit): Promise<T> {
 const baseUrl = this.config.baseUrl || 'https://ide.zhejiangjinmo.com';
 const url = baseUrl + '/api' + path;
 const controller = new AbortController();
 const timeoutId = setTimeout(() => controller.abort(), 15000);
 try {
 const res = await fetch(url, { ...options, headers: { ...this.headers, ...options?.headers }, signal: controller.signal });
 const data: any = await res.json().catch(() => ({}));
 if (!res.ok) {
   const err: any = new Error(data.error || 'HTTP ' + res.status);
   err.status = res.status;
   throw err;
 }
 return data;
 } finally {
 clearTimeout(timeoutId);
 }
 }
 private setCloudUser(result: any) {
 if (result && result.ok && result.token) {
 this._jwtToken = result.token;
 this._cloudUser = result.user || null;
 }
 }
 async registerDevice(deviceName?: string): Promise<any> {
 const result: any = await this.request('/auth/register', { method: 'POST', body: JSON.stringify({ deviceId: this._deviceId || undefined, deviceName: deviceName || 'Mobile - ' + Platform.OS, deviceInfo: { platform: Platform.OS, version: Platform.Version }, apiKey: this.config.apiKey || undefined }) });
 this._jwtToken = result.token; this._deviceId = result.deviceId; return result;
 }
 async verifyToken(): Promise<any> {
 if (!this._jwtToken && !this.config.token) throw new Error('Not authenticated');
 return this.request('/auth/verify');
 }

 // --- Auth ---
 async login(username: string, password: string): Promise<{ok: boolean; token?: string; user?: any; error?: string}> {
 try { const result = await this.request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); this.setCloudUser(result); return result; }
 catch (e: any) { return { ok: false, error: e.message }; }
 }
 async signup(username: string, password: string, email?: string): Promise<{ok: boolean; token?: string; user?: any; error?: string}> {
 try { const result = await this.request<any>('/auth/signup', { method: 'POST', body: JSON.stringify({ username, password, email }) }); this.setCloudUser(result); return result; }
 catch (e: any) { return { ok: false, error: e.message }; }
 }
 async cloudLogout(): Promise<void> {
 this._jwtToken = null; this._cloudUser = null; this.disconnectWs();
 }

 // --- Sessions (with cloud AI fallback) ---
 async getSessions(limit = 50) { return this.request<any>('/sessions?limit=' + limit); }
 async getSession(id: string) { return this.request<any>('/sessions/' + id); }
 async sendMessage(conversationId: string, message: string) {
   // Directly use cloud AI — faster and works without desktop
   console.log('[Mobile API] Sending via cloud AI...');
   return this.request<any>('/mobile/chat', {
     method: 'POST',
     body: JSON.stringify({ message, conversationId, platform: 'mobile' }),
   });
 }

 // --- Plans ---
 async getPlans() { return this.request<any>('/plans'); }
 async getPlan(id: string) { return this.request<any>('/plans/' + id); }

 // --- Tasks ---
 async getTasks() { return this.request<any>('/quest-tasks'); }

 // --- WebSocket ---
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
 this.wsSend({ type: 'desktop:list' });
 this.heartbeatTimer = setInterval(() => {
 if (this.ws?.readyState === WebSocket.OPEN) {
 this.ws.send(JSON.stringify({ type: 'ping' }));
 }
 }, 30000);
 };
 this.ws.onmessage = (event) => {
 try {
 const msg = JSON.parse(event.data);
 if (msg.type === 'pong') return;
 if (msg.type === 'desktop:list' || msg.type === 'desktop:registered' || msg.type === 'desktop:heartbeat:ack') {
 this.wsCallbacks.forEach(cb => cb(msg));
 return;
 }
 if (msg.type === 'relay:from-desktop' || msg.type === 'relay:ack') {
 this.wsCallbacks.forEach(cb => cb(msg));
 return;
 }
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
 if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
 this.onConnectionChange?.(false);
 this.scheduleReconnect();
 };
 this.ws.onerror = () => {
 console.log('[Mobile API] WebSocket error');
 };
 }
 private scheduleReconnect() {
 if (this.reconnectTimer) return;
 const delay = Math.min(3000 * Math.pow(2, this.wsReconnectAttempt), this.wsMaxReconnectDelay);
 this.wsReconnectAttempt++;
 console.log('[Mobile API] Reconnecting in ' + delay + 'ms (attempt ' + this.wsReconnectAttempt + ')');
 this.reconnectTimer = setTimeout(() => {
 this.reconnectTimer = null;
 this.connectWs();
 }, delay);
 }

 disconnectWs() {
 if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
 if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
 if (this.ws) { this.ws.close(); this.ws = null; }
 }

 private wsSend(msg: any) {
 if (this.ws?.readyState === WebSocket.OPEN) {
 this.ws.send(JSON.stringify(msg));
 }
 }

 wsCommand(channel: string, action: string, payload: any = {}): Promise<any> {
 return new Promise((resolve, reject) => {
 const id = channel + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
 this.wsCallbacks.set(id, (resp: any) => {
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

 subscribeWs(callback: Function) {
 const key = 'cb-' + Date.now();
 this.wsCallbacks.set(key, callback);
 return () => this.wsCallbacks.delete(key);
 }

 isConnected(): boolean {
 return this.ws?.readyState === WebSocket.OPEN;
 }

 // --- HTTP API methods ---
 async upsertSession(session: any) { return this.request<any>('/sessions', { method: 'POST', body: JSON.stringify(session) }); }
 async deleteSession(id: string) { return this.request<any>('/sessions/' + id, { method: 'DELETE' }); }
 async createQuest(message: string, scenario = 'spec') { return this.request<any>('/quest', { method: 'POST', body: JSON.stringify({ message, scenario }) }); }
 async getMemories() { return this.request<any>('/memories'); }
 async searchMemories(query?: string) { const qs = query ? '?action=search&query=' + encodeURIComponent(query) : ''; return this.request<any>('/memories' + qs); }
 async saveMemory(memory: any) { return this.request<any>('/memories', { method: 'POST', body: JSON.stringify(memory) }); }
 async listSchedules(status?: string) { const qs = status ? '?status=' + encodeURIComponent(status) : ''; return this.request<any>('/schedules' + qs); }
 async createSchedule(params: any) { return this.request<any>('/schedules', { method: 'POST', body: JSON.stringify(params) }); }
 async deleteSchedule(id: string) { return this.request<any>('/schedules/' + id, { method: 'DELETE' }); }
 async triggerSchedule(id: string) { return this.request<any>('/schedules/' + id + '/trigger', { method: 'POST' }); }
 async getScheduleLogs(id: string) { return this.request<any>('/schedules/' + id + '/logs'); }
 async triggerWebhook(channel: string, payload: any) { return this.request<any>('/webhook/' + encodeURIComponent(channel), { method: 'POST', body: JSON.stringify(payload) }); }
 async getSubscription() { return this.request<any>('/subscription'); }
 async getPlans2() { return this.request<any>('/plans'); }
 async getPayments() { return this.request<any>('/payments'); }
 async upgrade(planId: string) { return this.request<any>('/subscriptions/upgrade', { method: 'POST', body: JSON.stringify({ planId }) }); }
 async downgrade(planId: string) { return this.request<any>('/subscriptions/downgrade', { method: 'POST', body: JSON.stringify({ planId }) }); }
 async createPayment(channel: string, amount: number, planId: string) { return this.request<any>('/payments/create', { method: 'POST', body: JSON.stringify({ channel, amount, planId }) }); }
 async confirmPayment(orderId: string) { return this.request<any>('/payments/confirm/' + orderId, { method: 'POST' }); }
 async queryPayment(orderId: string) { return this.request<any>('/payments/query/' + orderId); }
 async getDevices() { return this.request<any>('/auth/devices'); }
 async registerDeviceEndpoint(deviceInfo: any) { return this.request<any>('/user/devices/register', { method: 'POST', body: JSON.stringify(deviceInfo) }); }
 async heartbeat() { return this.request<any>('/user/devices/heartbeat', { method: 'PUT' }); }
 async getStatus() { return this.request<any>('/status'); }
 sendRelayToDesktop(targetDeviceId: string, payload: any) {
   this.wsSend({ type: 'relay:to-desktop', targetDeviceId, payload, correlationId: `mobile-${Date.now()}`, timestamp: new Date().toISOString() });
 }
 listDesktops() { this.wsSend({ type: 'desktop:list' }); }

 // ── File Operations ──
  async readFile(path: string): Promise<{path: string; content: string; size: number; mtime: string}> {
    return this.request<any>('/files/read?path=' + encodeURIComponent(path));
  }
  async writeFile(path: string, content: string): Promise<{success: boolean; path: string}> {
    return this.request<any>('/files/write', { method: 'PUT', body: JSON.stringify({ path, content }) });
  }

  // ── Requirements (需求 + 审批) ──
  async getRequirements(params?: {status?: string; assignee?: string}): Promise<any[]> {
    let qs = '';
    if (params?.status) qs += '&status=' + encodeURIComponent(params.status);
    if (params?.assignee) qs += '&assignee=' + encodeURIComponent(params.assignee);
    return this.request<any>('/requirements' + (qs ? '?' + qs.slice(1) : ''));
  }
  async createRequirement(data: {title: string; description?: string; assignee?: string; priority?: string}): Promise<any> {
    return this.request<any>('/requirements', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateRequirement(id: string, data: any): Promise<any> {
    return this.request<any>('/requirements/' + id, { method: 'PUT', body: JSON.stringify(data) });
  }
  async approveRequirement(id: string, comment?: string): Promise<any> {
    return this.request<any>('/requirements/' + id + '/approve', { method: 'PUT', body: JSON.stringify({ comment }) });
  }
  async rejectRequirement(id: string, comment?: string): Promise<any> {
    return this.request<any>('/requirements/' + id + '/reject', { method: 'PUT', body: JSON.stringify({ comment }) });
  }
  async deleteRequirement(id: string): Promise<any> {
    return this.request<any>('/requirements/' + id, { method: 'DELETE' });
  }

  // ── CI/CD Status ──
  async getCiStatus(): Promise<{jobs: any[]; history: any[]; total: number}> {
    return this.request<any>('/ci/status');
  }

  // ── Desktop Online Check ──
  async getDesktopStatus(): Promise<{hasDesktop: boolean; onlineCount: number; devices: any[]; message: string}> {
    try {
      return await this.request<any>('/desktop/status');
    } catch {
      return { hasDesktop: false, onlineCount: 0, devices: [], message: '无法检查桌面状态' };
    }
  }

  async checkForUpdates(currentVersion: string): Promise<UpdateInfo | null> {
    try {
      const res = await fetch('https://ide.zhejiangjinmo.com/api/latest');
      const data: any = await res.json();
      if (!res.ok) return null;
      // Use proper semver comparison (only newer, not equal)
      const latest = data.version || '';
      const isNewer = (a: string, b: string) => {
        const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          if ((pa[i] || 0) > (pb[i] || 0)) return true;
          if ((pa[i] || 0) < (pb[i] || 0)) return false;
        }
        return false;
      };
      const hasUpdate = data.hasUpdate === true && isNewer(latest, currentVersion);
      const androidUrl = typeof data.files?.android === 'string'
        ? data.files.android
        : data.files?.android?.url?.startsWith('http')
          ? data.files.android.url
          : `https://ide.zhejiangjinmo.com/downloads/lingjing-v${latest}.apk`;
      const androidSize = data.platforms?.android?.size || data.files?.android?.size || 0;
      return { hasUpdate, version: latest, status: data.status || '', releaseDate: data.releaseDate || '', releaseNotes: data.releaseNotes || '', downloadUrl: androidUrl, fileSize: androidSize };
    } catch { return null; }
  }
}

export interface UpdateInfo {
  hasUpdate: boolean;
  version: string;
  status: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string | null;
  fileSize: number;
}

export const api = new ApiService();
