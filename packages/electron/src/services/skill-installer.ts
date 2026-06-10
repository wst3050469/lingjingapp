import { createLogger } from '../monitoring/logger';
import { SecurityScanner } from '@codepilot/core/fusion';
import { getDatabase, saveDatabase } from '../db/database.js';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, writeFileSync, existsSync } from 'fs';

const logger = createLogger('skill-installer');

const SKILLS_DIR = join(homedir(), '.lingjing', 'skills');

export class SkillInstaller {
  private scanner = new SecurityScanner();

  async download(skillId: string, downloadUrl: string): Promise<{ content: string; path: string }> {
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
      const content = await response.text();
      const installPath = join(SKILLS_DIR, skillId);
      return { content, path: installPath };
    } catch (err) {
      logger.error('Failed to download skill', err as Error, { skillId });
      throw err;
    }
  }

  scanSecurity(content: string, skillPath: string): { allowed: boolean; riskLevel: string; findings: any[] } {
    const result = this.scanner.scan(content, skillPath);
    return {
      allowed: result.allowed,
      riskLevel: result.riskLevel,
      findings: result.findings,
    };
  }

  resolveDependencies(deps: string[]): { resolved: boolean; conflicts: string[] } {
    return { resolved: true, conflicts: [] };
  }

  registerLocally(skillId: string, content: string, installPath: string): void {
    if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });
    if (!existsSync(installPath)) mkdirSync(installPath, { recursive: true });
    writeFileSync(join(installPath, 'index.js'), content);
    logger.info('Skill registered locally', { skillId, installPath });
  }

  async injectConfig(skillId: string, toolConfig: Record<string, unknown>): Promise<void> {
    try {
      const db = getDatabase();
      const id = `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      db.run(
        `INSERT OR REPLACE INTO skill_installations (id, skill_id, user_id, installed_version, install_path, security_scan_result, status, installed_at, updated_at)
         VALUES (?, ?, 'local', '1.0.0', ?, '{}', 'active', datetime('now'), datetime('now'))`,
        [id, skillId, join(SKILLS_DIR, skillId)],
      );
      await saveDatabase();
      logger.info('Skill config injected', { skillId });
    } catch (err) {
      logger.error('Failed to inject skill config', err as Error, { skillId });
    }
  }
}

export const skillInstaller = new SkillInstaller();