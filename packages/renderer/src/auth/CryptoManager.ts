import { CryptoConfig, DEFAULT_CRYPTO_CONFIG } from './types';

export class CryptoManager {
  private config: CryptoConfig;
  private key: CryptoKey | null = null;
  
  constructor(config: Partial<CryptoConfig> = {}) {
    this.config = { ...DEFAULT_CRYPTO_CONFIG, ...config };
  }
  
  async initialize(deviceId: string): Promise<void> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(deviceId),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const salt = encoder.encode('lingjing-token-salt');
    
    this.key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.config.iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: this.config.algorithm,
        length: this.config.keyLength,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  async encrypt(plaintext: string): Promise<string> {
    if (!this.key) {
      throw new Error('CryptoManager not initialized');
    }
    
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength));
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.config.algorithm,
        iv,
      },
      this.key,
      encoder.encode(plaintext)
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return this.arrayBufferToBase64(combined.buffer);
  }
  
  async decrypt(ciphertext: string): Promise<string> {
    if (!this.key) {
      throw new Error('CryptoManager not initialized');
    }
    
    const combined = this.base64ToArrayBuffer(ciphertext);
    const iv = combined.slice(0, this.config.ivLength);
    const encrypted = combined.slice(this.config.ivLength);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.config.algorithm,
        iv,
      },
      this.key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
  
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  
  static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  }
  
  static generateDeviceId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
