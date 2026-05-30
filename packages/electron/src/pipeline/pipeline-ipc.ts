import { ipcMain } from 'electron';
import { PipelineService } from './pipeline-service.js';

let service: PipelineService | null = null;

function getService(projectPath: string): PipelineService {
  if (!service) service = new PipelineService(projectPath);
  return service;
}

export function registerPipelineIPC(): void {
  ipcMain.handle('pipeline:list', async (_e, projectPath: string) => {
    return getService(projectPath).listPipelines();
  });
  ipcMain.handle('pipeline:get', async (_e, projectPath: string, id: string) => {
    const list = await getService(projectPath).listPipelines();
    return list.find((p: any) => p.id === id);
  });
  ipcMain.handle('pipeline:save', async (_e, projectPath: string, definition: any) => {
    return getService(projectPath).savePipeline(definition);
  });
  ipcMain.handle('pipeline:delete', async (_e, projectPath: string, id: string) => {
    return getService(projectPath).deletePipeline(id);
  });
  ipcMain.handle('pipeline:trigger', async (_e, projectPath: string, pipelineId: string, triggerType?: string) => {
    return getService(projectPath).triggerPipeline(pipelineId, (triggerType as any) || 'manual');
  });
  ipcMain.handle('pipeline:cancel', async (_e, projectPath: string, runId: string) => {
    return getService(projectPath).cancelPipeline(runId);
  });
  ipcMain.handle('pipeline:runHistory', async (_e, projectPath: string, pipelineId: string, limit?: number) => {
    return getService(projectPath).getRunHistory(pipelineId, limit);
  });
  ipcMain.handle('pipeline:runDetail', async (_e, projectPath: string, runId: string) => {
    return getService(projectPath).getRunDetail(runId);
  });
}
