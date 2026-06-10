import { CryptoManager } from './CryptoManager';
import { StoredTokens, TokenPayload, TokenValidationResult, DecryptedTokens } from './types';

const STORAGE_KEY = 'lingjing-cloud-tokens';
const DEVICE_ID_KEY = 'lingjing-device-id';

export class TokenStorage {
  private crypto: CryptoManager;
  private initialized: boolean = false;
  
  constructor() {
    this.crypto = new CryptoManager();
  }
  
  async initialize(): Promise<void> {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = CryptoManager.generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    await this.crypto.initialize(deviceId);
    this.initialized = true;
  }
  
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('TokenStorage not initialized. Call initialize() first.');
    }
  }
  
  async storeTokens(tokens: StoredTokens): Promise<void> {
    this.ensureInitialized();
    
    try {
      const plaintext = JSON.stringify(tokens);
      const encrypted = await this.crypto.encrypt(plaintext);
      localStorage.setItem(STORAGE_KEY, encrypted);
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Token storage failed');
    }
  }
  
  async getTokens(): Promise<DecryptedTokens | null> {
    this.ensureInitialized();
    
    try {
      const encrypted = localStorage.getItem(STORAGE_KEY);
      if (!encrypted) {
        return null;
      }
      
      const decrypted = await this.crypto.decrypt(encrypted);
      const tokens = JSON.parse(decrypted) as DecryptedTokens;
      
      return tokens;
    } catch (error) {
      console.error('Failed to get tokens:', error);
      return null;
    }
  }
  
  async removeTokens(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }
  
  hasTokens(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
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
      console.error('Failed to parse JWT:', error);
      return null;
    }
  }
  
  validateToken(token: string): TokenValidationResult {
    const payload = this.parseJWT(token);
    
    if (!payload) {
      return {
        valid: false,
        expired: false,
        error: 'Invalid token format',
      };
    }
    
    const now = Math.floor(Date.now() / 1000);
    const expired = payload.exp < now;
    
    return {
      valid: !expired,
      expired,
      payload,
      error: expired ? 'Token expired' : undefined,
    };
  }
  
  isTokenExpiringSoon(token: string, thresholdSeconds: number = 300): boolean {
    const payload = this.parseJWT(token);
    if (!payload) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now < thresholdSeconds;
  }
  
  getAccessToken(): Promise<string | null> {
    return this.getTokens().then(tokens => tokens?.accessToken || null);
  }
  
  getRefreshToken(): Promise<string | null> {
    return this.getTokens().then(tokens => tokens?.refreshToken || null);
  }
}
