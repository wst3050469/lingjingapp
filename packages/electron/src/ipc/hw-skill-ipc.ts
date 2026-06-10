import { ipcMain } from 'electron';
import { hwSkillManager } from '../services/hw-skill-manager.js';
import { skillPackageManager } from '../services/skill-package-manager.js';
import { cliAdapterExecutor } from '../services/cli-adapter-executor.js';
import { detectKicad, detectOpenscad, detectCliAvailability } from '../services/cli-dependency-detector.js';

export function registerHwSkillIpc(): void {
  ipcMain.handle('hw-skill:register', async (_event, { skill }: { skill: any }) => {
    try {
      return await hwSkillManager.register(skill);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('hw-skill:unregister', async (_event, { skillId }: { skillId: string }) => {
    try {
      hwSkillManager.unregister(skillId);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('hw-skill:list', async () => {
    return hwSkillManager.listSkills();
  });

  ipcMain.handle('hw-skill:get-tools', async (_event, { skillId }: { skillId: string }) => {
    return hwSkillManager.getToolsForSkill(skillId);
  });

  ipcMain.handle('hw-skill:execute', async (_event, { skillId, toolName, params }: { skillId: string; toolName: string; params: Record<string, unknown> }) => {
    try {
      const skill = hwSkillManager.getSkill(skillId);
      if (!skill) return { success: false, error: 'Skill not found' };
      const tool = skill.tools[toolName];
      if (!tool) return { success: false, error: 'Tool not found' };
      const args = [toolName, ...Object.values(params).map(String)];
      const result = await cliAdapterExecutor.executeCommand(tool.cliCommand || skillId, args, { timeout: cliAdapterExecutor.getTimeoutForTool(toolName) });
      return result;
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('hw-skill:install', async (_event, { skillDir }: { skillDir: string }) => {
    try {
      const pkg = await skillPackageManager.pack(skillDir);
      if (!pkg) return { success: false, error: 'Failed to pack skill' };
      return await skillPackageManager.installFromPackage(pkg);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('hw-skill:uninstall', async (_event, { skillId }: { skillId: string }) => {
    return await skillPackageManager.uninstall(skillId);
  });

  ipcMain.handle('hw-skill:detect-cli', async (_event, { command, versionRange }: { command: string; versionRange: string }) => {
    return await detectCliAvailability(command, versionRange);
  });

  ipcMain.handle('hw-skill:list-installed', async () => {
    return await skillPackageManager.listInstalled();
  });
}