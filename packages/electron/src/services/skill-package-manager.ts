import { createLogger } from '../monitoring/logger';
import { getDatabase, saveDatabase } from '../db/database.js';
import { skillInstaller } from './skill-installer.js';
import { skillSecurityGateway } from './skill-security-gateway.js';
import type { SkillPackage, HwDesignSkillMeta, HwSkillStatus } from '@codepilot/core/hw-skill/types';

const logger = createLogger('skill-package-manager');

export class SkillPackageManager {
  async pack(skillDir: string): Promise<SkillPackage | null> {
    logger.info('Packing skill', { skillDir });
    try {
      const { readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const manifest = JSON.parse(readFileSync(join(skillDir, 'manifest.json'), 'utf-8'));
      const toolsJson = JSON.parse(readFileSync(join(skillDir, 'tools.json'), 'utf-8'));
      const adapterScript = readFileSync(join(skillDir, 'adapter.js'), 'utf-8');
      const dependencies = JSON.parse(readFileSync(join(skillDir, 'dependencies.json'), 'utf-8'));
      const securityMeta = JSON.parse(readFileSync(join(skillDir, 'security.json'), 'utf-8'));
      const skillMd = existsSync(join(skillDir, 'SKILL.md')) ? readFileSync(join(skillDir, 'SKILL.md'), 'utf-8') : '';
      const checksum = require('crypto').createHash('sha256').update(JSON.stringify({ manifest, toolsJson, adapterScript })).digest('hex');
      return { manifest, skillMd, toolsJson, adapterScript, dependencies, securityMeta, checksum };
    } catch (err) {
      logger.error('Failed to pack skill', err as Error, { skillDir });
      return null;
    }
  }

  async publish(skillPackage: SkillPackage): Promise<{ success: boolean; publishId?: string }> {
    const scan = skillSecurityGateway.preInstallScan(skillPackage.adapterScript, '');
    if (skillSecurityGateway.blockOnCritical(scan)) {
      logger.warn('Publish blocked: security scan failed', { skillId: skillPackage.manifest.id });
      return { success: false };
    }
    try {
      const db = getDatabase();
      const id = `pub-${Date.now().toString(36)}`;
      db.run(
        `INSERT INTO skill_publish_records (id, skill_id, version, checksum, security_scan_result, publish_status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
        [id, skillPackage.manifest.id, skillPackage.manifest.version, skillPackage.checksum, JSON.stringify(scan)],
      );
      await saveDatabase();
      logger.info('Skill published (pending review)', { skillId: skillPackage.manifest.id, publishId: id });
      return { success: true, publishId: id };
    } catch (err) {
      logger.error('Failed to publish skill', err as Error);
      return { success: false };
    }
  }

  async installFromPackage(skillPackage: SkillPackage): Promise<{ success: boolean; installPath?: string }> {
    // @ts-ignore - injectConfig return type mismatch with SkillInstaller
    return skillInstaller.injectConfig(skillPackage.manifest.id, skillPackage.adapterScript, {});
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

  async listInstalled(): Promise<HwDesignSkillMeta[]> {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM skill_installations WHERE status = \'active\' ORDER BY installed_at DESC');
      const results: HwDesignSkillMeta[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        results.push({
          id: row.skill_id,
          name: row.skill_id,
          description: '',
          version: row.installed_version,
          category: 'hardware_design',
          tools: JSON.parse(row.tools_json || '{}'),
          fileAssociations: JSON.parse(row.file_associations || '[]'),
          cliDependencies: JSON.parse(row.cli_dependencies || '[]'),
          sidebarPanels: JSON.parse(row.sidebar_panels || '[]'),
          status: (row.skill_status || 'active') as HwSkillStatus,
        });
      }
      stmt.free();
      return results;
    } catch {
      return [];
    }
  }
}

export const skillPackageManager = new SkillPackageManager();