import { describe, it, expect } from 'vitest';
import { SkillToolAdapterFactory } from '../skill-tool-adapter-factory';

describe('SkillToolAdapterFactory', () => {
  const factory = new SkillToolAdapterFactory();

  describe('createTool', () => {
    it('should create an AgentTool from ToolDeclaration', () => {
      const declaration = { name: 'kicad_drc_check', description: 'DRC check', parameters: { type: 'object' }, returns: { type: 'object' }, cliCommand: 'kicad-cli drc', timeout: 60000 };
      const tool = factory.createTool('kicad-skill', declaration, async () => ({ success: true }));
      expect(tool.name).toBe('kicad_drc_check');
      expect(tool.description).toBe('DRC check');
    });
  });

  describe('createToolsFromSkill', () => {
    it('should create multiple tools from skill', () => {
      const tools = {
        tool1: { name: 'tool1', description: 'Tool 1', parameters: {}, returns: {} },
        tool2: { name: 'tool2', description: 'Tool 2', parameters: {}, returns: {} },
      };
      const agentTools = factory.createToolsFromSkill('test-skill', tools, async () => ({}));
      expect(agentTools.length).toBe(2);
      expect(agentTools[0].name).toBe('tool1');
    });
  });
});