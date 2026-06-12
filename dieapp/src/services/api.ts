// API 服务层 - 灵境云通信
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS, API as API_ENDPOINTS } from '../constants';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiConfig {
  baseUrl: string;
  token?: string | null;
  wsUrl?: string;
}

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

class ApiService {
  private config: ApiConfig = { baseUrl: CLOUD_SERVER_URL };
  private ws: WebSocket | null = null;
  private wsListeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  configure(config: Partial<ApiConfig>) {
    this.config = { ...this.config, ...config };
  }

  getToken(): string | null {
    return this.config.token || null;
  }

  private async request<T>(method: HttpMethod, path: string, body?: any): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, error: data?.error || `HTTP ${res.status}`, status: res.status };
      }
      return { ok: true, data, status: res.status };
    } catch (e: any) {
      return { ok: false, error: e.message || '网络错误' };
    }
  }

  // Auth
  async login(username: string, password: string) {
    return this.request<{ token: string; user: any }>('POST', API_ENDPOINTS.LOGIN, { username, password });
  }
  async register(username: string, password: string) {
    return this.request<{ token: string; user: any }>('POST', API_ENDPOINTS.REGISTER, { username, password });
  }
  async verifyToken() {
    return this.request<{ user: any }>('GET', API_ENDPOINTS.VERIFY_TOKEN);
  }
  async sendSmsCode(phone: string) {
    return this.request('POST', API_ENDPOINTS.SMS_SEND, { phone });
  }
  async smsLogin(phone: string, code: string) {
    return this.request<{ token: string; user: any }>('POST', API_ENDPOINTS.SMS_LOGIN, { phone, code });
  }

  // User
  async getUserProfile() {
    return this.request<{ user: any }>('GET', API_ENDPOINTS.USER_PROFILE);
  }
  async updateUserProfile(data: any) {
    return this.request('POST', API_ENDPOINTS.UPDATE_PROFILE, data);
  }
  async deleteAccount(code?: string) {
    return this.request('POST', API_ENDPOINTS.DELETE_ACCOUNT, code ? { code } : {});
  }
  async sendDeleteAccountCode() {
    return this.request('POST', API_ENDPOINTS.DELETE_ACCOUNT_SEND_CODE);
  }

  // Sessions
  async getSessions(params?: { status?: string; limit?: number; offset?: number }) {
    const q = new URLSearchParams(params as any).toString();
    return this.request<any[]>('GET', `${API_ENDPOINTS.SESSIONS}${q ? '?' + q : ''}`);
  }
  async getActiveSessions() {
    return this.request<any[]>('GET', API_ENDPOINTS.SESSIONS_ACTIVE);
  }
  async createSession(data: { title?: string; environment?: string; repo?: string; branch?: string }) {
    return this.request<any>('POST', API_ENDPOINTS.SESSIONS, data);
  }
  async archiveSession(id: string) {
    return this.request('POST', API_ENDPOINTS.SESSIONS_ARCHIVE, { id });
  }

  // Conversations
  async getConversations(sessionId: string) {
    return this.request<any[]>('GET', `${API_ENDPOINTS.CONVERSATIONS}?sessionId=${sessionId}`);
  }
  async sendMessage(sessionId: string, content: string, attachments?: string[]) {
    return this.request('POST', API_ENDPOINTS.CONVERSATIONS, { sessionId, content, attachments });
  }

  // Tasks
  async getTasks(params?: { tab?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return this.request<any[]>('GET', `${API_ENDPOINTS.TASKS}${q ? '?' + q : ''}`);
  }
  async approveAction(sessionId: string, actionId: string, option: string) {
    return this.request('POST', `${API_ENDPOINTS.TASKS}/approve`, { sessionId, actionId, option });
  }
  async submitPlanReview(sessionId: string, approved: boolean, feedback?: string) {
    return this.request('POST', `${API_ENDPOINTS.TASKS}/plan-review`, { sessionId, approved, feedback });
  }
  async answerQuestion(sessionId: string, questionId: string, answer: any) {
    return this.request('POST', `${API_ENDPOINTS.TASKS}/answer`, { sessionId, questionId, answer });
  }

  // Usage & Feedback
  async getUsage() {
    return this.request<any>('GET', API_ENDPOINTS.USAGE);
  }
  async submitFeedback(data: { description: string; email?: string; sessionId?: string }) {
    return this.request('POST', API_ENDPOINTS.FEEDBACK, data);
  }
  async checkUpdate(currentVersion: string) {
    return this.request<any>('GET', `${API_ENDPOINTS.CHECK_UPDATE}?current=${currentVersion}`);
  }

  // WebSocket
  connectWs() {
    this.disconnectWs();
    const url = this.config.wsUrl || CLOUD_SERVER_WS;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this.emit('_connected', {}); };
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.emit(msg.type || 'message', msg);
      } catch {}
    };
    this.ws.onclose = () => {
      this.emit('_disconnected', {});
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {};
  }

  disconnectWs() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => { this.connectWs(); }, 3000);
  }

  onWs(event: string, fn: (data: any) => void) {
    if (!this.wsListeners.has(event)) this.wsListeners.set(event, new Set());
    this.wsListeners.get(event)!.add(fn);
    return () => { this.wsListeners.get(event)?.delete(fn); };
  }

  private emit(event: string, data: any) {
    this.wsListeners.get(event)?.forEach(fn => fn(data));
  }
}

export const api = new ApiService();
