import { createLogger } from '../monitoring/logger';
import { readFile as readFileFS, writeFile as writeFileFS, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const logger = createLogger('config-module');

export interface SystemConfig {
  general: {
    language: 'zh-CN' | 'en-US';
    theme: 'light' | 'dark' | 'auto';
    autoUpdate: boolean;
    updateChannel: 'stable' | 'beta' | 'canary';
    dataCollection: boolean;
  };
  performance: {
    maxConcurrentTasks: number;
    maxCacheSize: number;
    enableGpu: boolean;
    enableIndexing: boolean;
  };
  security: {
    encryptionEnabled: boolean;
    autoLockMinutes: number;
    allowRemoteAccess: boolean;
  };
  network: {
    proxyEnabled: boolean;
    proxyUrl?: string;
    timeout: number;
    retryAttempts: number;
  };
  advanced: {
    debugMode: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    experimentalFeatures: boolean;
  };
}

const DEFAULT_CONFIG: SystemConfig = {
  general: {
    language: 'zh-CN',
    theme: 'auto',
    autoUpdate: true,
    updateChannel: 'stable',
    dataCollection: true
  },
  performance: {
    maxConcurrentTasks: 5,
    maxCacheSize: 100,
    enableGpu: false,
    enableIndexing: true
  },
  security: {
    encryptionEnabled: true,
    autoLockMinutes: 30,
    allowRemoteAccess: false
  },
  network: {
    proxyEnabled: false,
    timeout: 30000,
    retryAttempts: 3
  },
  advanced: {
    debugMode: false,
    logLevel: 'info',
    experimentalFeatures: false
  }
};

export class ConfigModule {
  private config: SystemConfig;
  private configPath: string;
  private watchers: Array<(config: SystemConfig) => void>;

  constructor() {
    this.configPath = join(homedir(), '.lingjing', 'system-config.json');
    this.watchers = [];
    this.config = this.loadConfig();
  }

  private loadConfig(): SystemConfig {
    try {
      if (existsSync(this.configPath)) {
        // @ts-expect-error - fs callback type
    const data = readFileFS(this.configPath, 'utf-8') as unknown as string;
        const loaded = JSON.parse(data);
        return this.mergeConfig(DEFAULT_CONFIG, loaded);
      }
    } catch (error) {
      logger.error('Failed to load config', error as Error);
    }

    return { ...DEFAULT_CONFIG };
  }

  private mergeConfig(defaults: any, loaded: any): any {
    const result = { ...defaults };

    for (const key of Object.keys(loaded)) {
      if (typeof loaded[key] === 'object' && !Array.isArray(loaded[key])) {
        result[key] = this.mergeConfig(defaults[key] || {}, loaded[key]);
      } else {
        result[key] = loaded[key];
      }
    }

    return result;
  }

  async saveConfig(): Promise<void> {
    try {
      // @ts-expect-error - fs callback type
    await writeFileFS(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info('Config saved');
    } catch (error) {
      logger.error('Failed to save config', error as Error);
      throw error;
    }
  }

  getConfig(): SystemConfig {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    this.config = this.mergeConfig(this.config, updates);
    await this.saveConfig();

    this.notifyWatchers();

    return this.getConfig();
  }

  async updateSection<K extends keyof SystemConfig>(
    section: K,
    updates: Partial<SystemConfig[K]>
  ): Promise<SystemConfig> {
    this.config[section] = {
      ...this.config[section],
      ...updates
    };

    await this.saveConfig();
    this.notifyWatchers();

    return this.getConfig();
  }

  get<K extends keyof SystemConfig>(section: K): SystemConfig[K] {
    return { ...this.config[section] };
  }

  async resetToDefaults(): Promise<SystemConfig> {
    this.config = { ...DEFAULT_CONFIG };
    await this.saveConfig();
    this.notifyWatchers();

    return this.getConfig();
  }

  async resetSection<K extends keyof SystemConfig>(section: K): Promise<SystemConfig> {
    this.config[section] = { ...DEFAULT_CONFIG[section] };
    await this.saveConfig();
    this.notifyWatchers();

    return this.getConfig();
  }

  watch(callback: (config: SystemConfig) => void): () => void {
    this.watchers.push(callback);

    return () => {
      this.watchers = this.watchers.filter(w => w !== callback);
    };
  }

  private notifyWatchers(): void {
    const current = this.getConfig();
    for (const watcher of this.watchers) {
      try {
        watcher(current);
      } catch (error) {
        logger.error('Config watcher error', error as Error);
      }
    }
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  async importConfig(configJson: string): Promise<SystemConfig> {
    try {
      const imported = JSON.parse(configJson);
      this.config = this.mergeConfig(DEFAULT_CONFIG, imported);
      await this.saveConfig();
      this.notifyWatchers();

      return this.getConfig();
    } catch (error) {
      logger.error('Failed to import config', error as Error);
      throw new Error('Invalid configuration format');
    }
  }

  validateConfig(config: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (config.general) {
      if (!['zh-CN', 'en-US'].includes(config.general.language)) {
        errors.push('Invalid language');
      }
      if (!['light', 'dark', 'auto'].includes(config.general.theme)) {
        errors.push('Invalid theme');
      }
      if (!['stable', 'beta', 'canary'].includes(config.general.updateChannel)) {
        errors.push('Invalid update channel');
      }
    }

    if (config.performance) {
      if (typeof config.performance.maxConcurrentTasks !== 'number' ||
          config.performance.maxConcurrentTasks < 1) {
        errors.push('Invalid maxConcurrentTasks');
      }
      if (typeof config.performance.maxCacheSize !== 'number' ||
          config.performance.maxCacheSize < 10) {
        errors.push('Invalid maxCacheSize');
      }
    }

    if (config.security) {
      if (typeof config.security.autoLockMinutes !== 'number' ||
          config.security.autoLockMinutes < 0) {
        errors.push('Invalid autoLockMinutes');
      }
    }

    if (config.network) {
      if (typeof config.network.timeout !== 'number' ||
          config.network.timeout < 1000) {
        errors.push('Invalid timeout');
      }
    }

    if (config.advanced) {
      if (!['debug', 'info', 'warn', 'error'].includes(config.advanced.logLevel)) {
        errors.push('Invalid logLevel');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const configModule = new ConfigModule();
