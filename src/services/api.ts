// 灵境AIIDE 移动端轻量版 - API Service Layer
// v2: 精简为纯对话 + 认证，移除任务/计划/订阅/定时/webhook等
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
  channel: 'chat';
  action: 'list' | 'get' | 'send' | 'subscribe' | 'unsubscribe';
  payload: Record<string, any>;
}

interface WsResponse {
  type: 'ack' | 'push' | 'pong' | 'error';
  id?: string; success?: boolean; data?: any; error?: string; channel?: string; event?: string;
}

type WsCallback = (data: WsResponse) => void;


class ApiService {
  private config: ApiConfig = { baseUrl: '', token: '', wsUrl: '' };
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<string, Function> = new Map();
  private wsSubscriptions: Set<string> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  public onConnectionChange?: (connected: boolean) => void;
  private _deviceId: string | null = null;
  private _jwtToken: string | null = null;
  private _cloudUser: any = null;
  get deviceId(): string | null { return this._deviceId; }
  get jwtToken(): string | null { return this._jwtToken; }
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
    const baseUrl = this.config.baseUrl || 'https://www.spiritrealmz.com';
    const url = baseUrl + '/api' + path;
    let res: Response;
    try {
      res = await fetch(url, { ...options, headers: { ...this.headers, ...options?.headers } });
    } catch (e: any) {
      throw new Error('网络连接失败，请检查网络设置');
    }
    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new Error('服务器响应异常 (' + res.status + ')');
    }
    if (!res.ok) throw new Error(data.detail || data.error || data.msg || 'HTTP ' + res.status);
    return data;
  }

  // ── Auth ──
  async registerDevice(deviceName?: string): Promise<any> {
    const result: any = await this.request('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: this._deviceId || undefined,
        deviceName: deviceName || 'Mobile - ' + Platform.OS,
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
    return this.request('/v1/auth/verify');
  }
  async login(username: string, password: string): Promise<any> {
    const result = await this.request<any>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    // 适配后端返回格式 {code, token, nickname, ...} → {ok, token, user}
    if (result && result.token) {
      this._jwtToken = result.token;
      this._cloudUser = { id: result.token.slice(0, 8), username, nickname: result.nickname || username };
      return {
        ok: true,
        token: result.token,
        user: { id: result.token.slice(0, 8), username, nickname: result.nickname || username, email: result.email || '' },
      };
    }
    return { ok: false, error: '登录失败' };
  }
  async signup(username: string, password: string, email?: string): Promise<any> {
    const result = await this.request<any>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname: email || username, account_type: 'personal' }),
    });
    // 适配后端返回格式 {code, token, nickname} → {ok, token, user}
    if (result && result.token) {
      this._jwtToken = result.token;
      this._cloudUser = { id: result.token.slice(0, 8), username, nickname: result.nickname || username };
      return {
        ok: true,
        token: result.token,
        user: { id: result.token.slice(0, 8), username, nickname: result.nickname || username, email: email || '' },
      };
    }
    return { ok: false, error: '注册失败' };
  }

  // ── Sessions ──
  async getSessions(limit = 50) { return this.request<any>('/v1/chat/sessions?limit=' + limit); }
  async getSession(id: string) { return this.request<any>('/v1/chat/sessions/' + id + '/messages'); }
  async sendMessage(conversationId: string, message: string) {
    return this.request<any>('/v1/chat/send', {
      method: 'POST',
      body: JSON.stringify({ session_id: conversationId, content: message }),
    });
  }
  async upsertSession(session: any) {
    return this.request<any>('/v1/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  }
  async deleteSession(id: string) {
    return this.request<any>('/v1/chat/sessions/' + id, { method: 'DELETE' });
  }

  // ── WebSocket ──
  connectWs() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.disconnectWs();
    const token = this._jwtToken || this.config.token;
    const url = `${this.config.wsUrl}/api/v1/ws/${encodeURIComponent(token)}`;
    console.log('[Mobile API] Connecting WebSocket:', url.replace(token, '***'));
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      console.log('[Mobile API] WebSocket connected');
      this.onConnectionChange?.(true);
      this.wsSubscriptions.forEach(ch => this.wsSend({
        type: 'cmd', id: `sub-${Date.now()}`,
        channel: ch as any, action: 'subscribe', payload: {},
      }));
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

  async cloudLogout(): Promise<void> {
    this._jwtToken = null;
    this._cloudUser = null;
    this.disconnectWs();
  }
}

export const api = new ApiService();
