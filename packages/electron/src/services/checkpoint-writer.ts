import { createLogger } from '../monitoring/logger';
import crypto from 'crypto';
import { getDatabase, saveDatabase } from '../db/database.js';

const logger = createLogger('checkpoint-writer');

const ENCRYPTION_KEY_ENV = 'LINGJING_CHECKPOINT_KEY';
const DB_KEY_NAME = 'checkpoint_encryption_key';
let encryptionKey: string | null = null;
let keyLoaded = false;

function getEncryptionKey(): string {
  if (encryptionKey) return encryptionKey;

  // Priority 1: environment variable (allows cross-device sync with same key)
  const envKey = process.env[ENCRYPTION_KEY_ENV];
  if (envKey) {
    encryptionKey = envKey;
    return encryptionKey;
  }

  // Priority 2: persisted key in database (survives restarts)
  if (!keyLoaded) {
    keyLoaded = true;
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(DB_KEY_NAME) as
        | { value: string }
        | undefined;
      if (row?.value) {
        encryptionKey = row.value;
        return encryptionKey!;
      }
    } catch {
      // Table may not exist yet (first boot) — ignore and generate new key
    }
  }

  // Priority 3: generate new random key and persist it
  encryptionKey = crypto.randomBytes(32).toString('hex');

  // Persist asynchronously — non-blocking, best-effort
  const keyToPersist = encryptionKey;
  try {
    const db = getDatabase();
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))',
      [DB_KEY_NAME, keyToPersist],
    );
    saveDatabase().catch(() => {});
  } catch {
    // If persistence fails, key is still usable in-memory for this session
  }

  return encryptionKey;
}

export class CheckpointWriter {
  // DEF-012: 计算明文HMAC签名用于完整性校验
  private computeHmac(plaintext: string): string {
    return crypto.createHmac('sha256', getEncryptionKey()).update(plaintext).digest('hex');
  }

  serialize(sessionState: {
    conversationMessages: any[];
    configSnapshot: Record<string, unknown>;
    toolRegistrySnapshot: Record<string, unknown>;
  }): string {
    return JSON.stringify(sessionState);
  }

  encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex').slice(0, 32), iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // DEF-012: 加密时附加HMAC签名
    const hmac = this.computeHmac(plaintext);
    return `${iv.toString('hex')}:${authTag}:${hmac}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');
    // DEF-012: 支持4段格式(iv:authTag:hmac:encrypted)和旧3段格式
    if (parts.length === 4) {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const hmac = parts[2];
      const encrypted = parts[3];
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex').slice(0, 32), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      const expectedHmac = this.computeHmac(decrypted);
      if (hmac !== expectedHmac) {
        throw new Error('Checkpoint HMAC integrity check failed — data may be corrupted');
      }
      return decrypted;
    }
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex').slice(0, 32), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    throw new Error('Invalid ciphertext format');
  }

  async writeAsync(sessionId: string, encryptedData: string, step: number, turnCount: number): Promise<void> {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const db = getDatabase();
        db.run(
          `INSERT OR REPLACE INTO agent_sessions
           (session_id, conversation_json, checkpoint_step, checkpoint_timestamp, turn_count, last_activity_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [sessionId, encryptedData, step, Date.now(), turnCount, Date.now()],
        );
        await saveDatabase();
        logger.debug('Checkpoint written', { sessionId, step, attempt });
        return;
      } catch (err) {
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        logger.error('Failed to write checkpoint after retries', err as Error, { sessionId });
        throw err;
      }
    }
  }

  // DEF-012: 验证checkpoint数据完整性
  verifyIntegrity(encryptedData: string): boolean {
    try {
      this.decrypt(encryptedData);
      return true;
    } catch (err) {
      logger.error('Checkpoint integrity check failed', err as Error);
      return false;
    }
  }
}

export const checkpointWriter = new CheckpointWriter();
