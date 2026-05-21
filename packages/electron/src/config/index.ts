import { app } from 'electron';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface CloudSyncConfig {
  serverUrl: string;
  apiKey: string;
  jwtSecret: string;
  syncInterval: number;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
}

interface GitHubConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

interface FileSyncConfig {
  maxSize: number;
  chunkSize: number;
  maxConcurrent: number;
}

interface TokenConfig {
  refreshThreshold: number;
  maxAge: number;
}

interface OfflineQueueConfig {
  maxSize: number;
  maxRetries: number;
  retryDelay: number;
}

interface AppConfig {
  cloudSync: CloudSyncConfig;
  github: GitHubConfig;
  fileSync: FileSyncConfig;
  token: TokenConfig;
  offlineQueue: OfflineQueueConfig;
}

function loadEnvFile(): Record<string, string> {
  const isDev = !app.isPackaged;
  const envFile = isDev ? '.env.development' : '.env.production';
  const envPath = join(app.getAppPath(), envFile);
  
  if (!existsSync(envPath)) {
    console.warn(`[Config] Environment file not found: ${envPath}`);
    return {};
  }
  
  const content = readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return env;
}

function getEnv(key: string, defaultValue?: string): string {
  const env = loadEnvFile();
  return env[key] || process.env[key] || defaultValue || '';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = getEnv(key);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = getEnv(key);
  return value ? value.split(',').map(s => s.trim()) : defaultValue;
}

export function loadConfig(): AppConfig {
  return {
    cloudSync: {
      serverUrl: getEnv('CLOUD_SYNC_SERVER_URL', 'https://ide.zhejiangjinmo.com'),
      apiKey: getEnv('CLOUD_SYNC_API_KEY', '5379dcbe873b356430d84f3f68b0f0c6e96e2afa3b8a9b5441c9e4d7f5a0b1c2'),
      jwtSecret: getEnv('CLOUD_SYNC_JWT_SECRET', 'a1e9886e99cdd5fa3bb0f090919cd57b4b2b22a5a5214800'),
      syncInterval: getEnvNumber('CLOUD_SYNC_INTERVAL', 300000),
      maxRetries: getEnvNumber('CLOUD_SYNC_MAX_RETRIES', 3),
      retryDelay: getEnvNumber('CLOUD_SYNC_RETRY_DELAY', 5000),
      batchSize: getEnvNumber('CLOUD_SYNC_BATCH_SIZE', 100)
    },
    github: {
      clientId: getEnv('GITHUB_CLIENT_ID', ''),
      clientSecret: getEnv('GITHUB_CLIENT_SECRET', ''),
      redirectUri: getEnv('GITHUB_REDIRECT_URI', 'lingjing://github/callback'),
      scope: getEnvArray('GITHUB_SCOPE', ['repo', 'user', 'gist'])
    },
    fileSync: {
      maxSize: getEnvNumber('FILE_SYNC_MAX_SIZE', 100 * 1024 * 1024),
      chunkSize: getEnvNumber('FILE_SYNC_CHUNK_SIZE', 5 * 1024 * 1024),
      maxConcurrent: getEnvNumber('FILE_SYNC_MAX_CONCURRENT', 3)
    },
    token: {
      refreshThreshold: getEnvNumber('TOKEN_REFRESH_THRESHOLD', 300000),
      maxAge: getEnvNumber('TOKEN_MAX_AGE', 86400000)
    },
    offlineQueue: {
      maxSize: getEnvNumber('OFFLINE_QUEUE_MAX_SIZE', 10000),
      maxRetries: getEnvNumber('OFFLINE_QUEUE_MAX_RETRIES', 5),
      retryDelay: getEnvNumber('OFFLINE_QUEUE_RETRY_DELAY', 1000)
    }
  };
}

export const config = loadConfig();
