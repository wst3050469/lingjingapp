import { createLogger } from '../monitoring/logger';

const logger = createLogger('skill-version-manager');

export class SkillVersionManager {
  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const a = parts1[i] ?? 0;
      const b = parts2[i] ?? 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  async update(skillId: string, targetVersion: string): Promise<{ success: boolean }> {
    logger.info('Updating skill', { skillId, targetVersion });
    return { success: true };
  }

  notifyUpdate(skillId: string, availableVersion: string, installedVersion: string): void {
    if (this.compareVersions(availableVersion, installedVersion) > 0) {
      logger.info('Update available', { skillId, availableVersion, installedVersion });
    }
  }
}

export const skillVersionManager = new SkillVersionManager();