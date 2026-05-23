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
 var h: Record<string, string> = { 'Content-Type': 'application/json' };
 if (this._jwtToken) h['Authorization'] = 'Bearer ' + this._jwtToken;
 else if (this.config.token) h['Authorization'] = 'Bearer ' + this.config.token;
 else if (this.config.apiKey) h['x-api-key'] = this.config.apiKey;
 return h;
 }
 private async request<T>(path: string, options?: RequestInit): Promise<T> {
 var baseUrl = this.config.baseUrl || 'https://lingjing.zhejiangjinmo.com';
 var url = baseUrl + '/api' + path;
 var res = await fetch(url, { ...options, headers: { ...this.headers, ...options?.headers } });
 var data = await res.json();
 if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
 return data;
 }
 private setCloudUser(result: any) {
 if (result && result.ok && result.token) {
 this._jwtToken = result.token;
 this._cloudUser = result.user || null;
 }
 }
 async registerDevice(deviceName?: string): Promise<any> {
 var result: any = await this.request('/auth/register', { method: 'POST', body: JSON.stringify({ deviceId: this._deviceId || undefined, deviceName: deviceName || 'Mobile - ' + Platform.OS, deviceInfo: { platform: Platform.OS, version: Platform.Version }, apiKey: this.config.apiKey || undefined }) });
 this._jwtToken = result.token; this._deviceId = result.deviceId; return result;
 }
 async verifyToken(): Promise<any> {
 if (!this._jwtToken && !this.config.token) throw new Error('Not authenticated');
 return this.request('/auth/verify');
 }

 // --- Auth ---
 async login(username: string, password: string): Promise<{ok: boolean; token?: string; user?: any; error?: string}> {
 try { var result = await this.request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); this.setCloudUser(result); return result; }
 catch (e: any) { return { ok: false, error: e.message }; }
 }
 async signup(username: string, password: string, email?: string): Promise<{ok: boolean; token?: string; user?: any; error?: string}> {
 try { var result = await this.request<any>('/auth/signup', { method: 'POST', body: JSON.stringify({ username, password, email }) }); this.setCloudUser(result); return result; }
 catch (e: any) { return { ok: false, error: e.message }; }
 }
 async cloudLogout(): Promise<void> {
 this._jwtToken = null; this._cloudUser = null; this.disconnectWs();
 }

 // --- Sessions ---
 async getSessions(limit = 50) { return this.request<any>('/sessions?limit=' + limit); }
 async getSession(id: string) { return this.request<any>('/sessions/' + id); }
 async sendMessage(conversationId: string, message: string) {
 return this.request<any>('/sessions/' + conversationId + '/send', { method: 'POST', body: JSON.stringify({ message }) });
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
 this.heartbeatTimer = setInterval(() => {
 if (this.ws?.readyState === WebSocket.OPEN) {
 this.ws.send(JSON.stringify({ type: 'ping' }));
 }
 }, 30000);
 };
 this.ws.onmessage = (event) => {
 try {
 const msg = JSON.parse(event.data);
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
 this.reconnectTimer = setTimeout(() => {
 this.reconnectTimer = null;
 this.connectWs();
 }, 3000);
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
 async searchMemories(query?: string) { var qs = query ? '?action=search&query=' + encodeURIComponent(query) : ''; return this.request<any>('/memories' + qs); }
 async saveMemory(memory: any) { return this.request<any>('/memories', { method: 'POST', body: JSON.stringify(memory) }); }
 async listSchedules(status?: string) { var qs = status ? '?status=' + encodeURIComponent(status) : ''; return this.request<any>('/schedules' + qs); }
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
 async getDevices() { return this.request<any>('/devices'); }
 async registerDeviceEndpoint(deviceInfo: any) { return this.request<any>('/user/devices/register', { method: 'POST', body: JSON.stringify(deviceInfo) }); }
 async heartbeat() { return this.request<any>('/user/devices/heartbeat', { method: 'PUT' }); }
 async getStatus() { return this.request<any>('/status'); }
}

export const api = new ApiService();
