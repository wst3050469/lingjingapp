import { ipcMain } from 'electron';
import { aiHwDesignService } from '../services/ai-hw-design-service.js';

export function registerHwAiIpc(): void {
  ipcMain.handle('hw-ai:generate-schematic', async (_event, { description, sessionId }: { description: string; sessionId: string }) => {
    try {
      return await aiHwDesignService.generateSchematic(description, sessionId);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('hw-ai:suggest-pcb-layout', async (_event, { schematicContent, sessionId }: { schematicContent: string; sessionId: string }) => {
    try {
      return await aiHwDesignService.suggestPcbLayout(schematicContent, sessionId);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('hw-ai:suggest-drc-fix', async (_event, { violations, sessionId }: { violations: string; sessionId: string }) => {
    try {
      return await aiHwDesignService.suggestDrcFix(violations, sessionId);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('hw-ai:select-component', async (_event, { requirements, sessionId }: { requirements: string; sessionId: string }) => {
    try {
      return await aiHwDesignService.selectComponent(requirements, sessionId);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('hw-ai:apply-result', async (_event, { resultId }: { resultId: string }) => {
    return await aiHwDesignService.applyResult(resultId);
  });

  ipcMain.handle('hw-ai:rollback-result', async (_event, { resultId }: { resultId: string }) => {
    return await aiHwDesignService.rollbackResult(resultId);
  });

  ipcMain.handle('hw-ai:set-prompt-config', async (_event, { config }: { config: any }) => {
    aiHwDesignService.setPromptConfig(config);
    return { success: true };
  });
}