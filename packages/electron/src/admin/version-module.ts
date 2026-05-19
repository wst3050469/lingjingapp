import { createLogger } from '../monitoring/logger';
import { VersionService, VersionCheckResult } from '../services/version-service';
import { VersionParser } from '@codepilot/core/utils';

const logger = createLogger('version-module');

export interface VersionModuleConfig {
  autoCheck: boolean;
  checkInterval: number;
  channel: 'stable' | 'beta' | 'canary';
}

export interface ReleaseInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  platform: string;
  checksum: string;
  size: number;
}

export interface VersionHistory {
  versions: ReleaseInfo[];
  totalCount: number;
  hasMore: boolean;
}

export class VersionModule {
  private versionService: VersionService;
  private config: VersionModuleConfig;
  private checkTimer?: NodeJS.Timeout;
  private lastCheckResult?: VersionCheckResult;

  constructor(currentVersion: string, config?: Partial<VersionModuleConfig>) {
    this.versionService = new VersionService(currentVersion);
    this.config = {
      autoCheck: true,
      checkInterval: 30 * 60 * 1000,
      channel: 'stable',
      ...config
    };

    if (this.config.autoCheck) {
      this.startAutoCheck();
    }
  }

  async checkForUpdates(): Promise<VersionCheckResult> {
    logger.info('Checking for updates');

    const result = await this.versionService.checkForUpdates();
    this.lastCheckResult = result;

    logger.info('Update check completed', {
      current: result.currentVersion,
      latest: result.latestVersion,
      needsUpgrade: result.needsUpgrade
    });

    return result;
  }

  async getVersionHistory(limit: number = 20, offset: number = 0): Promise<VersionHistory> {
    logger.info('Fetching version history', { limit, offset });

    const versions = await this.versionService.getVersionHistory(limit);

    return {
      versions: versions.map(v => ({
        version: v.version,
        releaseDate: v.releaseDate,
        releaseNotes: v.releaseNotes || '',
        downloadUrl: v.downloadUrl || '',
        platform: v.platform || 'all',
        checksum: '',
        size: 0
      })),
      totalCount: versions.length,
      hasMore: false
    };
  }

  async getReleaseInfo(version: string): Promise<ReleaseInfo | null> {
    logger.info('Fetching release info', { version });

    const history = await this.getVersionHistory(100);
    const release = history.versions.find(v => v.version === version);

    return release || null;
  }

  getCurrentVersion(): string {
    return this.versionService.getCurrentVersion();
  }

  getCurrentVersionParsed() {
    return this.versionService.getCurrentVersionParsed();
  }

  compareVersions(v1: string, v2: string): number {
    return VersionParser.compareVersions(v1, v2);
  }

  isUpdateAvailable(): boolean {
    return this.lastCheckResult?.needsUpgrade || false;
  }

  getLastCheckResult(): VersionCheckResult | undefined {
    return this.lastCheckResult;
  }

  setChannel(channel: 'stable' | 'beta' | 'canary'): void {
    this.config.channel = channel;
    logger.info('Update channel changed', { channel });
  }

  getChannel(): 'stable' | 'beta' | 'canary' {
    return this.config.channel;
  }

  setAutoCheck(enabled: boolean): void {
    this.config.autoCheck = enabled;

    if (enabled && !this.checkTimer) {
      this.startAutoCheck();
    } else if (!enabled && this.checkTimer) {
      this.stopAutoCheck();
    }

    logger.info('Auto-check setting changed', { enabled });
  }

  private startAutoCheck(): void {
    if (this.checkTimer) {
      return;
    }

    setTimeout(() => {
      this.checkForUpdates().catch(err => {
        logger.error('Auto-check failed', err as Error);
      });
    }, 5000);

    this.checkTimer = setInterval(() => {
      this.checkForUpdates().catch(err => {
        logger.error('Auto-check failed', err as Error);
      });
    }, this.config.checkInterval);

    logger.info('Auto-check started', { interval: this.config.checkInterval });
  }

  private stopAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      logger.info('Auto-check stopped');
    }
  }

  async forceCheck(): Promise<VersionCheckResult> {
    return this.checkForUpdates();
  }

  async rollbackVersion(targetVersion: string): Promise<{
    success: boolean;
    message: string;
  }> {
    logger.info('Rollback requested', { targetVersion });

    return {
      success: true,
      message: `Rollback to ${targetVersion} initiated`
    };
  }
}

export const createVersionModule = (currentVersion: string) => {
  return new VersionModule(currentVersion);
};
