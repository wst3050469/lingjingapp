import { createLogger } from '../monitoring/logger';
import type { ToolDeclaration } from '@codepilot/core/hw-skill/types';

const logger = createLogger('skill-tool-adapter-factory');

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<any>;
}

export class SkillToolAdapterFactory {
  createTool(skillId: string, declaration: ToolDeclaration, executeFn: (params: Record<string, unknown>) => Promise<any>): AgentTool {
    return {
      name: declaration.name,
      description: declaration.description,
      parameters: declaration.parameters,
      execute: async (params) => {
        logger.debug('Executing tool via adapter', { skillId, toolName: declaration.name });
        return executeFn(params);
      },
    };
  }

  createToolsFromSkill(skillId: string, tools: Record<string, ToolDeclaration>, executeFn: (toolName: string, params: Record<string, unknown>) => Promise<any>): AgentTool[] {
    return Object.values(tools).map((declaration) =>
      this.createTool(skillId, declaration, (params) => executeFn(declaration.name, params))
    );
  }
}

export const skillToolAdapterFactory = new SkillToolAdapterFactory();