import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { getDatabase, saveDatabase } from '../db/database.js';
import type { SkillMetaRecord, SkillCategory } from '../db/types/ide-enhance-types.js';

const logger = createLogger('skill-marketplace-client');

const MARKETPLACE_BASE_URL = 'https://ide.zhejiangjinmo.com/api/v1/marketplace';

export class SkillMarketplaceClient extends EventEmitter {
  async browse(opts?: { category?: SkillCategory; sort?: string; page?: number; limit?: number }): Promise<{ skills: SkillMetaRecord[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (opts?.category) params.set('category', opts.category);
      if (opts?.sort) params.set('sort', opts.sort);
      if (opts?.page) params.set('page', String(opts.page));
      if (opts?.limit) params.set('limit', String(opts.limit));

      const response = await fetch(`${MARKETPLACE_BASE_URL}/skills?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      logger.error('Failed to browse marketplace', err as Error);
      return { skills: [], total: 0 };
    }
  }

  async search(keyword: string): Promise<SkillMetaRecord[]> {
    try {
      const response = await fetch(`${MARKETPLACE_BASE_URL}/skills/search?q=${encodeURIComponent(keyword)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.skills ?? [];
    } catch (err) {
      logger.error('Failed to search marketplace', err as Error);
      return [];
    }
  }

  async getDetail(skillId: string): Promise<SkillMetaRecord | null> {
    try {
      const response = await fetch(`${MARKETPLACE_BASE_URL}/skills/${skillId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      logger.error('Failed to get skill detail', err as Error, { skillId });
      return null;
    }
  }

  async install(skillId: string, version?: string): Promise<{ success: boolean; installPath?: string }> {
    try {
      const response = await fetch(`${MARKETPLACE_BASE_URL}/skills/${skillId}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      logger.error('Failed to install skill', err as Error, { skillId });
      return { success: false };
    }
  }

  async uninstall(skillId: string): Promise<{ success: boolean }> {
    try {
      const db = getDatabase();
      db.run('DELETE FROM skill_installations WHERE skill_id = ?', [skillId]);
      await saveDatabase();
      return { success: true };
    } catch (err) {
      logger.error('Failed to uninstall skill', err as Error, { skillId });
      return { success: false };
    }
  }

  async rate(skillId: string, rating: number): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${MARKETPLACE_BASE_URL}/skills/${skillId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { success: true };
    } catch (err) {
      logger.error('Failed to rate skill', err as Error, { skillId });
      return { success: false };
    }
  }

  async checkUpdates(): Promise<SkillMetaRecord[]> {
    return [];
  }
}

export const skillMarketplaceClient = new SkillMarketplaceClient();