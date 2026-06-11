import { TokenStorage } from './TokenStorage';
import { CloudAuthClient } from './CloudAuthClient';
import { StoredTokens } from './types';

export interface AuthState {
  isAuthenticated: boolean;
  isOnline: boolean;
  userId: string | null;
  email: string | null;
  loading: boolean;
  error: string | null;
}

export type AuthMode = 'online' | 'offline';

export interface AuthManagerConfig {
  onAuthSuccess?: (tokens: StoredTokens) => void;
  onAuthFailure?: (error: string) => void;
  onOfflineMode?: () => void;
  onOnlineMode?: () => void;
  autoRefreshThreshold?: number;
}

const DEFAULT_CONFIG: Required<AuthManagerConfig> = {
  onAuthSuccess: () => {},
  onAuthFailure: () => {},
  onOfflineMode: () => {},
  onOnlineMode: () => {},
  autoRefreshThreshold: 300,
};

export class AuthManager {
  private tokenStorage: TokenStorage;
  private authClient: CloudAuthClient;
  private config: Required<AuthManagerConfig>;
  private state: AuthState;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private stateListeners: Set<(state: AuthState) => void> = new Set();
  
  constructor(config: AuthManagerConfig = {}) {
    this.tokenStorage = new TokenStorage();
    this.authClient = new CloudAuthClient();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.state = {
      isAuthenticated: false,
      isOnline: false,
      userId: null,
      email: null,
      loading: true,
      error: null,
    };
  }
  
  async initialize(): Promise<void> {
    try {
      await this.tokenStorage.initialize();
      
      const tokens = await this.tokenStorage.getTokens();
      
      if (!tokens) {
        this.updateState({ loading: false });
        return;
      }
      
      const validation = this.tokenStorage.validateToken(tokens.accessToken);
      
      if (validation.valid) {
        await this.handleAuthSuccess(tokens, 'online');
      } else if (validation.expired) {
        const refreshed = await this.tryRefreshToken(tokens.refreshToken);
        if (!refreshed) {
          await this.switchToOfflineMode(tokens);
        }
      } else {
        await this.switchToOfflineMode(tokens);
      }
    } catch (error) {
      console.error('AuthManager initialization failed:', error);
      this.updateState({
        loading: false,
        error: 'Initialization failed',
      });
    }
  }
  
  private async handleAuthSuccess(tokens: StoredTokens, mode: AuthMode): Promise<void> {
    this.updateState({
      isAuthenticated: true,
      isOnline: mode === 'online',
      userId: tokens.userId,
      email: tokens.email,
      loading: false,
      error: null,
    });
    
    if (mode === 'online') {
      this.config.onAuthSuccess(tokens);
      this.scheduleTokenRefresh(tokens.accessToken);
    }
  }
  
  private async switchToOfflineMode(tokens: StoredTokens): Promise<void> {
    console.log('Switching to offline mode');
    
    this.updateState({
      isAuthenticated: true,
      isOnline: false,
      userId: tokens.userId,
      email: tokens.email,
      loading: false,
      error: null,
    });
    
    this.config.onOfflineMode();
    
    this.schedulePeriodicRetry();
  }
  
  private async tryRefreshToken(refreshToken: string): Promise<boolean> {
    const response = await this.authClient.refreshToken(refreshToken);
    
    if (response.success && response.token && response.refreshToken) {
      const payload = this.authClient.parseJWT(response.token);
      
      if (payload) {
        const newTokens: StoredTokens = {
          accessToken: response.token,
          refreshToken: response.refreshToken,
          expiresAt: payload.exp * 1000,
          userId: payload.userId,
          email: payload.email,
        };
        
        await this.tokenStorage.storeTokens(newTokens);
        await this.handleAuthSuccess(newTokens, 'online');
        return true;
      }
    }
    
    return false;
  }
  
  private scheduleTokenRefresh(accessToken: string): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    const payload = this.tokenStorage.parseJWT(accessToken);
    if (!payload) return;
    
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = payload.exp - now;
    const refreshIn = Math.max(expiresIn - this.config.autoRefreshThreshold, 60);
    
    this.refreshTimer = setTimeout(async () => {
      const tokens = await this.tokenStorage.getTokens();
      if (tokens) {
        await this.tryRefreshToken(tokens.refreshToken);
      }
    }, refreshIn * 1000);
  }
  
  private schedulePeriodicRetry(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    this.refreshTimer = setTimeout(async () => {
      const tokens = await this.tokenStorage.getTokens();
      if (tokens) {
        const verifyResponse = await this.authClient.verify(tokens.accessToken);
        
        if (verifyResponse.success) {
          await this.handleAuthSuccess(tokens, 'online');
          this.config.onOnlineMode();
        } else {
          this.schedulePeriodicRetry();
        }
      }
    }, 5 * 60 * 1000);
  }
  
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    this.updateState({ loading: true, error: null });
    
    try {
      const response = await this.authClient.login(email, password);
      
      if (response.success && response.token && response.refreshToken && response.user) {
        const payload = this.authClient.parseJWT(response.token);
        
        if (payload) {
          const tokens: StoredTokens = {
            accessToken: response.token,
            refreshToken: response.refreshToken,
            expiresAt: payload.exp * 1000,
            userId: response.user.id,
            email: response.user.email,
          };
          
          await this.tokenStorage.storeTokens(tokens);
          await this.handleAuthSuccess(tokens, 'online');
          
          return { success: true };
        }
      }
      
      const error = response.error || 'Login failed';
      this.updateState({ loading: false, error });
      this.config.onAuthFailure(error);
      
      return { success: false, error };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      this.updateState({ loading: false, error: errorMessage });
      this.config.onAuthFailure(errorMessage);
      
      return { success: false, error: errorMessage };
    }
  }
  
  async signup(
    email: string,
    password: string,
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    this.updateState({ loading: true, error: null });
    
    try {
      const response = await this.authClient.signup(email, password, username);
      
      if (response.success && response.token && response.refreshToken && response.user) {
        const payload = this.authClient.parseJWT(response.token);
        
        if (payload) {
          const tokens: StoredTokens = {
            accessToken: response.token,
            refreshToken: response.refreshToken,
            expiresAt: payload.exp * 1000,
            userId: response.user.id,
            email: response.user.email,
          };
          
          await this.tokenStorage.storeTokens(tokens);
          await this.handleAuthSuccess(tokens, 'online');
          
          return { success: true };
        }
      }
      
      const error = response.error || 'Signup failed';
      this.updateState({ loading: false, error });
      this.config.onAuthFailure(error);
      
      return { success: false, error };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed';
      this.updateState({ loading: false, error: errorMessage });
      this.config.onAuthFailure(errorMessage);
      
      return { success: false, error: errorMessage };
    }
  }
  
  async logout(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    await this.tokenStorage.removeTokens();
    
    this.updateState({
      isAuthenticated: false,
      isOnline: false,
      userId: null,
      email: null,
      loading: false,
      error: null,
    });
  }
  
  getState(): AuthState {
    return { ...this.state };
  }
  
  subscribe(listener: (state: AuthState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }
  
  private updateState(partial: Partial<AuthState>): void {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach(listener => listener(this.state));
  }
  
  async getAccessToken(): Promise<string | null> {
    return this.tokenStorage.getAccessToken();
  }
}
