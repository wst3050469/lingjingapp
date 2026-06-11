import { ipcMain } from 'electron';
import { PipelineService } from './pipeline-service.js';

const services = new Map<string, PipelineService>();

function getService(projectPath: string): PipelineService {
  if (!services.has(projectPath)) services.set(projectPath, new PipelineService(projectPath));
  return services.get(projectPath)!;
}

export function registerPipelineIPC(): void {
  ipcMain.handle('pipeline:list', async (_e, projectPath: string) => {
    try {
      return await getService(projectPath).listPipelines();
    } catch (err: any) {
      return [];
    }
  });
  ipcMain.handle('pipeline:get', async (_e, projectPath: string, id: string) => {
    try {
      const list = await getService(projectPath).listPipelines();
      return list.find((p: any) => p.id === id) || null;
    } catch (err: any) {
      return null;
    }
  });
  ipcMain.handle('pipeline:save', async (_e, projectPath: string, definition: any) => {
    try {
      if (!definition) {
        return { success: false, error: 'definition is required' };
      }
      if (!definition.id) {
        definition.id = `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      if (!definition.name) {
        definition.name = definition.id;
      }
      return await getService(projectPath).savePipeline(definition);
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });
  ipcMain.handle('pipeline:delete', async (_e, projectPath: string, id: string) => {
    try {
      return await getService(projectPath).deletePipeline(id);
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });
  ipcMain.handle('pipeline:trigger', async (_e, projectPath: string, pipelineId: string, triggerType?: string) => {
    try {
      const validTrigger = ['manual', 'push', 'schedule', 'webhook'].includes(triggerType || '') ? triggerType : 'manual';
      return await getService(projectPath).triggerPipeline(pipelineId, validTrigger as any);
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });
  ipcMain.handle('pipeline:cancel', async (_e, projectPath: string, runId: string) => {
    try {
      return await getService(projectPath).cancelPipeline(runId);
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });
  ipcMain.handle('pipeline:runHistory', async (_e, projectPath: string, pipelineId: string, limit?: number) => {
    try {
      return await getService(projectPath).getRunHistory(pipelineId, limit);
    } catch (err: any) {
      return [];
    }
  });
  ipcMain.handle('pipeline:runDetail', async (_e, projectPath: string, runId: string) => {
    try {
      return await getService(projectPath).getRunDetail(runId);
    } catch (err: any) {
      return null;
    }
  });
}
