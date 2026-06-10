import { logger } from '../../utils/logger.js';
import type { SkillMeta } from './types.js';

interface LoadedSkill {
  metadata: SkillMeta;
  fullContent?: string;
}

export class ProgressiveLoader {
  private loadedSkills = new Map<string, LoadedSkill>();

  async loadMetadata(skillPath: string): Promise<SkillMeta> {
    const existing = this.loadedSkills.get(skillPath);
    if (existing) {
      return existing.metadata;
    }

    const metadata = await this.parseFrontmatter(skillPath);
    this.loadedSkills.set(skillPath, { metadata });
    return metadata;
  }

  async loadFullContent(skillPath: string): Promise<string> {
    const existing = this.loadedSkills.get(skillPath);
    if (existing?.fullContent) {
      return existing.fullContent;
    }

    const fullContent = await this.readSkillFile(skillPath);
    const metadata = await this.parseFrontmatter(skillPath);
    this.loadedSkills.set(skillPath, { metadata, fullContent });
    return fullContent;
  }

  getLoadedSkills(): ReadonlyMap<string, LoadedSkill> {
    return this.loadedSkills;
  }

  isLoaded(skillPath: string): boolean {
    return this.loadedSkills.has(skillPath);
  }

  private async parseFrontmatter(skillPath: string): Promise<SkillMeta> {
    const content = await this.readSkillFile(skillPath);
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return this.defaultMeta(skillPath);
    }

    try {
      const yaml = frontmatterMatch[1];
      const meta = this.parseSimpleYaml(yaml);
      return {
        name: (meta.name as string) ?? this.extractNameFromPath(skillPath),
        description: (meta.description as string) ?? '',
        triggers: (meta.triggers as string[]) ?? [],
        tools: (meta.tools as string[]) ?? [],
        level: (meta.level as string) ?? 'user',
      };
    } catch {
      return this.defaultMeta(skillPath);
    }
  }

  private async readSkillFile(_skillPath: string): Promise<string> {
    return '';
  }

  private parseSimpleYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
      if (match) {
        const key = match[1];
        const value = match[2].trim();
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key] = value.slice(1, -1).split(',').map((s) => s.trim());
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  private extractNameFromPath(skillPath: string): string {
    const parts = skillPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || skillPath;
  }

  private defaultMeta(skillPath: string): SkillMeta {
    return {
      name: this.extractNameFromPath(skillPath),
      description: '',
      triggers: [],
      tools: [],
      level: 'user',
    };
  }
}
