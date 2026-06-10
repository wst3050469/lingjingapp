import { EventEmitter } from 'events';
import { createLogger } from '../monitoring/logger';
import { detectKicad, detectOpenscad } from './cli-dependency-detector.js';
import type { HwDesignSkillMeta, HwSkillStatus } from '@codepilot/core/hw-skill/types';

const logger = createLogger('hw-skill-manager');

export class HwSkillManager extends EventEmitter {
  private registeredSkills = new Map<string, HwDesignSkillMeta>();

  async register(skill: HwDesignSkillMeta): Promise<{ success: boolean; status: HwSkillStatus }> {
    for (const dep of skill.cliDependencies) {
      if (dep.command === 'kicad-cli') {
        const result = await detectKicad();
        if (!result.available) {
          skill.status = 'dependency-missing';
          this.registeredSkills.set(skill.id, skill);
          return { success: false, status: 'dependency-missing' };
        }
        if (!result.compatible) {
          skill.status = 'version-incompatible';
          this.registeredSkills.set(skill.id, skill);
          return { success: false, status: 'version-incompatible' };
        }
      }
      if (dep.command === 'openscad') {
        const result = await detectOpenscad();
        if (!result.available) {
          skill.status = 'dependency-missing';
          this.registeredSkills.set(skill.id, skill);
          return { success: false, status: 'dependency-missing' };
        }
      }
    }
    skill.status = 'installed';
    this.registeredSkills.set(skill.id, skill);
    this.emit('skill-registered', { skillId: skill.id });
    logger.info('Skill registered', { skillId: skill.id, status: skill.status });
    return { success: true, status: 'installed' };
  }

  unregister(skillId: string): void {
    this.registeredSkills.delete(skillId);
    this.emit('skill-unregistered', { skillId });
    logger.info('Skill unregistered', { skillId });
  }

  getSkill(skillId: string): HwDesignSkillMeta | undefined {
    return this.registeredSkills.get(skillId);
  }

  listSkills(): HwDesignSkillMeta[] {
    return [...this.registeredSkills.values()];
  }

  getToolsForSkill(skillId: string): any[] {
    const skill = this.registeredSkills.get(skillId);
    return skill ? Object.values(skill.tools) : [];
  }

  getAllTools(): any[] {
    const tools: any[] = [];
    for (const skill of this.registeredSkills.values()) {
      tools.push(...Object.values(skill.tools));
    }
    return tools;
  }
}

export const hwSkillManager = new HwSkillManager();