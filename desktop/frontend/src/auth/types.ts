export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  exp: number;
  iat: number;
}

export interface CryptoConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
}

export const DEFAULT_CRYPTO_CONFIG: CryptoConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  saltLength: 16,
  iterations: 100000,
};

export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  payload?: TokenPayload;
  error?: string;
}

export interface DecryptedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}
