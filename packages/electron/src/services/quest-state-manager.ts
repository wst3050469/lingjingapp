import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';

const logger = createLogger('quest-state-manager');

export interface QuestAgentState {
  taskId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  conversation?: any;
  context?: any;
  metadata?: Record<string, any>;
  error?: string;
  checkpoint?: {
    step: number;
    timestamp: number;
    data?: any;
  };
}

export interface StateStorageConfig {
  maxCacheSize?: number;
  encryptionKey?: string;
  persistToDisk?: boolean;
  compress?: boolean;
}

const DEFAULT_CONFIG: Required<StateStorageConfig> = {
  maxCacheSize: 50,
  encryptionKey: '',
  persistToDisk: true,
  compress: false
};

export class QuestStateManager extends EventEmitter {
  private config: Required<StateStorageConfig>;
  private cache: Map<string, QuestAgentState>;
  private cacheOrder: string[];
  private storageDir: string;
  private indexedDB: Map<string, QuestAgentState>;
  private encryptionKey: Buffer | null;

  constructor(config?: StateStorageConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.cacheOrder = [];
    this.indexedDB = new Map();
    this.storageDir = join(homedir(), '.lingjing', 'quest-states');
    
    if (this.config.encryptionKey) {
      this.encryptionKey = scryptSync(
        this.config.encryptionKey,
        'salt',
        32
      );
    } else {
      this.encryptionKey = null;
    }

    if (this.config.persistToDisk) {
      this.ensureStorageDirectory();
      this.loadPersistedStates();
    }
  }

  private ensureStorageDirectory(): void {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async saveState(state: QuestAgentState): Promise<void> {
    const { taskId } = state;
    
    logger.info('Saving quest state', { taskId, status: state.status });

    const serialized = this.serialize(state);
    const encrypted = this.encryptIfNeeded(serialized);

    this.addToCache(taskId, state);
    this.indexedDB.set(taskId, state);

    if (this.config.persistToDisk) {
      await this.persistToDisk(taskId, encrypted);
    }

    this.emit('state-saved', { taskId, state });
  }

  async loadState(taskId: string): Promise<QuestAgentState | null> {
    logger.debug('Loading quest state', { taskId });

    const cached = this.cache.get(taskId);
    if (cached) {
      logger.debug('State found in cache', { taskId });
      return cached;
    }

    const fromMemory = this.indexedDB.get(taskId);
    if (fromMemory) {
      this.addToCache(taskId, fromMemory);
      return fromMemory;
    }

    if (this.config.persistToDisk) {
      const fromDisk = await this.loadFromDisk(taskId);
      if (fromDisk) {
        this.indexedDB.set(taskId, fromDisk);
        this.addToCache(taskId, fromDisk);
        return fromDisk;
      }
    }

    logger.warn('State not found', { taskId });
    return null;
  }

  async deleteState(taskId: string): Promise<void> {
    logger.info('Deleting quest state', { taskId });

    this.cache.delete(taskId);
    this.cacheOrder = this.cacheOrder.filter(id => id !== taskId);
    this.indexedDB.delete(taskId);

    if (this.config.persistToDisk) {
      const filePath = join(this.storageDir, `${taskId}.json`);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    this.emit('state-deleted', { taskId });
  }

  async getAllStates(): Promise<QuestAgentState[]> {
    const states: QuestAgentState[] = [];

    for (const taskId of this.indexedDB.keys()) {
      const state = await this.loadState(taskId);
      if (state) {
        states.push(state);
      }
    }

    return states.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getStatesByStatus(status: QuestAgentState['status']): Promise<QuestAgentState[]> {
    const all = await this.getAllStates();
    return all.filter(s => s.status === status);
  }

  async updateState(
    taskId: string,
    updates: Partial<QuestAgentState>
  ): Promise<QuestAgentState | null> {
    const existing = await this.loadState(taskId);
    if (!existing) {
      return null;
    }

    const updated: QuestAgentState = {
      ...existing,
      ...updates,
      taskId,
      updatedAt: Date.now()
    };

    await this.saveState(updated);
    return updated;
  }

  async createCheckpoint(
    taskId: string,
    step: number,
    data?: any
  ): Promise<void> {
    const state = await this.loadState(taskId);
    if (!state) {
      throw new Error(`State not found for task ${taskId}`);
    }

    const checkpoint = {
      step,
      timestamp: Date.now(),
      data
    };

    await this.updateState(taskId, { checkpoint });
    logger.info('Checkpoint created', { taskId, step });
  }

  async restoreFromCheckpoint(taskId: string): Promise<QuestAgentState | null> {
    const state = await this.loadState(taskId);
    if (!state || !state.checkpoint) {
      return null;
    }

    logger.info('Restoring from checkpoint', {
      taskId,
      step: state.checkpoint.step
    });

    return state;
  }

  private serialize(state: QuestAgentState): string {
    return JSON.stringify(state);
  }

  private deserialize(data: string): QuestAgentState {
    return JSON.parse(data);
  }

  private encryptIfNeeded(data: string): string {
    if (!this.encryptionKey) {
      return data;
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private decryptIfNeeded(data: string): string {
    if (!this.encryptionKey) {
      return data;
    }

    const buffer = Buffer.from(data, 'base64');
    
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  private addToCache(taskId: string, state: QuestAgentState): void {
    if (this.cache.has(taskId)) {
      this.cacheOrder = this.cacheOrder.filter(id => id !== taskId);
    }

    this.cache.set(taskId, state);
    this.cacheOrder.push(taskId);

    while (this.cacheOrder.length > this.config.maxCacheSize) {
      const oldest = this.cacheOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
        logger.debug('Evicted from cache', { taskId: oldest });
      }
    }
  }

  private async persistToDisk(taskId: string, data: string): Promise<void> {
    const filePath = join(this.storageDir, `${taskId}.json`);
    writeFileSync(filePath, data, 'utf8');
  }

  private async loadFromDisk(taskId: string): Promise<QuestAgentState | null> {
    try {
      const filePath = join(this.storageDir, `${taskId}.json`);
      if (!existsSync(filePath)) {
        return null;
      }

      const encrypted = readFileSync(filePath, 'utf8');
      const decrypted = this.decryptIfNeeded(encrypted);
      return this.deserialize(decrypted);
    } catch (error) {
      logger.error('Failed to load from disk', error as Error, { taskId });
      return null;
    }
  }

  private loadPersistedStates(): void {
    try {
      const files = readdirSync(this.storageDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const taskId = file.replace('.json', '');
        const filePath = join(this.storageDir, file);
        
        try {
          const encrypted = readFileSync(filePath, 'utf8');
          const decrypted = this.decryptIfNeeded(encrypted);
          const state = this.deserialize(decrypted);
          this.indexedDB.set(taskId, state);
        } catch (error) {
          logger.error('Failed to load persisted state', error as Error, { file });
        }
      }

      logger.info('Loaded persisted states', { count: this.indexedDB.size });
    } catch (error) {
      logger.error('Failed to load persisted states', error as Error);
    }
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: 0
    };
  }

  async cleanup(olderThan?: number): Promise<number> {
    const threshold = olderThan || Date.now() - 7 * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    const states = await this.getAllStates();
    for (const state of states) {
      if (state.updatedAt < threshold) {
        await this.deleteState(state.taskId);
        cleaned++;
      }
    }

    logger.info('Cleanup completed', { cleaned });
    return cleaned;
  }
}

export const questStateManager = new QuestStateManager();
