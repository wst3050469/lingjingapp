import { StoredTokens, TokenPayload } from './types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  username: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  error?: string;
}

export interface VerifyResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  error?: string;
}

export interface RefreshResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  error?: string;
}

const API_BASE_URL = 'https://lingjing.zhejiangjinmo.com/api';
const API_FALLBACK_URL = 'http://120.55.5.220:8000/api';

export class CloudAuthClient {
  private baseUrl: string;
  private timeout: number;
  
  constructor(baseUrl?: string, timeout: number = 10000) {
    this.baseUrl = baseUrl || API_BASE_URL;
    this.timeout = timeout;
  }
  
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: unknown,
    token?: string
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      if (this.baseUrl === API_BASE_URL) {
        console.warn('Primary API failed, trying fallback:', error);
        this.baseUrl = API_FALLBACK_URL;
        return this.request<T>(endpoint, method, body, token);
      }
      
      throw error;
    }
  }
  
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const hashedPassword = await this.hashPassword(password);
      
      const response = await this.request<AuthResponse>('/auth/login', 'POST', {
        username: email,
        password: hashedPassword,
      });
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }
  
  async signup(email: string, password: string, username: string): Promise<AuthResponse> {
    try {
      const hashedPassword = await this.hashPassword(password);
      
      const response = await this.request<AuthResponse>('/auth/signup', 'POST', {
        email,
        password: hashedPassword,
        username,
      });
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Signup failed',
      };
    }
  }
  
  async verify(token: string): Promise<VerifyResponse> {
    try {
      const response = await this.request<VerifyResponse>('/auth/me', 'POST', undefined, token);
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }
  
  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    try {
      const response = await this.request<RefreshResponse>('/auth/refresh', 'POST', {
        refreshToken,
      });
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  }
  
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  }
  
  parseJWT(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      return payload as TokenPayload;
    } catch (error) {
      return null;
    }
  }
}
