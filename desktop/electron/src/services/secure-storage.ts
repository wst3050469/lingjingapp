import { createHash, randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto';
import { hostname, platform, cpus, totalmem, networkInterfaces } from 'node:os';
import { app } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

export interface DeviceFingerprint {
  fingerprint: string;
  components: {
    hostname: string;
    platform: string;
    cpuModel: string;
    totalMemory: string;
    macAddress: string;
    appPath: string;
  };
}

export function generateDeviceFingerprint(): DeviceFingerprint {
  const components = {
    hostname: hostname(),
    platform: platform(),
    cpuModel: cpus()[0]?.model || 'unknown',
    totalMemory: String(totalmem()),
    macAddress: getPrimaryMacAddress(),
    appPath: app.getAppPath()
  };

  const fingerprintData = [
    components.hostname,
    components.platform,
    components.cpuModel,
    components.totalMemory,
    components.macAddress,
    components.appPath
  ].join('|');

  const fingerprint = createHash('sha256').update(fingerprintData).digest('hex');

  return { fingerprint, components };
}

function getPrimaryMacAddress(): string {
  const interfaces = networkInterfaces();
  
  for (const name of ['eth0', 'en0', 'Wi-Fi', 'Ethernet', 'WLAN']) {
    const iface = interfaces[name];
    if (iface) {
      for (const config of iface) {
        if (!config.internal && config.mac && config.mac !== '00:00:00:00:00:00') {
          return config.mac;
        }
      }
    }
  }

  for (const configs of Object.values(interfaces)) {
    for (const config of configs || []) {
      if (!config.internal && config.mac && config.mac !== '00:00:00:00:00:00') {
        return config.mac;
      }
    }
  }

  return '00:00:00:00:00:00';
}

export function deriveEncryptionKey(fingerprint: string, salt?: string): Buffer {
  const saltBuffer = salt 
    ? Buffer.from(salt, 'hex')
    : randomBytes(32);

  const key = pbkdf2Sync(
    fingerprint,
    saltBuffer,
    100000,
    32,
    'sha512'
  );

  return key;
}

export interface SecureStorageConfig {
  storagePath: string;
  encryptionKey: Buffer;
}

export function getSecureStoragePath(): string {
  const userDataPath = app.getPath('userData');
  const storagePath = join(userDataPath, 'secure-storage');
  
  if (!existsSync(storagePath)) {
    mkdirSync(storagePath, { recursive: true });
  }
  
  return storagePath;
}

export interface TokenEncryptionResult {
  encrypted: string;
  iv: string;
  authTag: string;
}

export function encryptToken(token: string, encryptionKey: Buffer): TokenEncryptionResult {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decryptToken(
  encrypted: string,
  iv: string,
  authTag: string,
  encryptionKey: Buffer
): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export class SecureTokenStorage {
  private config: SecureStorageConfig;
  private fingerprint: DeviceFingerprint;

  constructor() {
    this.fingerprint = generateDeviceFingerprint();
    const encryptionKey = deriveEncryptionKey(this.fingerprint.fingerprint);
    
    this.config = {
      storagePath: getSecureStoragePath(),
      encryptionKey
    };
  }

  saveToken(key: string, token: string): void {
    const { encrypted, iv, authTag } = encryptToken(token, this.config.encryptionKey);
    
    const data = {
      encrypted,
      iv,
      authTag,
      timestamp: Date.now()
    };

    const filePath = join(this.config.storagePath, `${key}.token`);
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  }

  loadToken(key: string): string | null {
    const filePath = join(this.config.storagePath, `${key}.token`);
    
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      return decryptToken(
        data.encrypted,
        data.iv,
        data.authTag,
        this.config.encryptionKey
      );
    } catch (err) {
      console.error(`[SecureStorage] Failed to load token ${key}:`, err);
      return null;
    }
  }

  deleteToken(key: string): void {
    const filePath = join(this.config.storagePath, `${key}.token`);
    if (existsSync(filePath)) {
      const fs = require('fs');
      fs.unlinkSync(filePath);
    }
  }

  getDeviceFingerprint(): string {
    return this.fingerprint.fingerprint;
  }
}
