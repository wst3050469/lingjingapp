import { ipcMain } from 'electron';
import { PMService } from './pm-service.js';

const services = new Map<string, PMService>();

function getService(projectPath: string): PMService {
  if (!services.has(projectPath)) services.set(projectPath, new PMService(projectPath));
  return services.get(projectPath)!;
}

export function registerPMIPC(): void {
  ipcMain.handle('pm:listWorkItems', async (_e, projectPath: string, filter?: any) => {
    return getService(projectPath).listWorkItems(filter);
  });
  ipcMain.handle('pm:createWorkItem', async (_e, projectPath: string, input: any) => {
    return getService(projectPath).createWorkItem(input);
  });
  ipcMain.handle('pm:updateWorkItem', async (_e, projectPath: string, id: string, input: any) => {
    return getService(projectPath).updateWorkItem(id, input);
  });
  ipcMain.handle('pm:deleteWorkItem', async (_e, projectPath: string, id: string) => {
    return getService(projectPath).deleteWorkItem(id);
  });
  ipcMain.handle('pm:updateStatus', async (_e, projectPath: string, id: string, status: string, changedBy?: string, wipLimit?: number, currentCount?: number) => {
    return getService(projectPath).updateStatus(id, status as any, changedBy, wipLimit, currentCount);
  });
  ipcMain.handle('pm:linkCommit', async (_e, projectPath: string, workItemId: string, commitSha: string, commitMessage: string) => {
    return getService(projectPath).linkCommit(workItemId, commitSha, commitMessage);
  });
  ipcMain.handle('pm:getBoard', async (_e, projectPath: string) => {
    return getService(projectPath).getBoard();
  });
  ipcMain.handle('pm:updateWipLimit', async (_e, projectPath: string, columnId: string, wipLimit: number) => {
    return getService(projectPath).updateWipLimit(columnId, wipLimit);
  });
  ipcMain.handle('pm:listMilestones', async (_e, projectPath: string) => {
    return getService(projectPath).listMilestones();
  });
  ipcMain.handle('pm:exportData', async (_e, projectPath: string, format?: string) => {
    return getService(projectPath).exportData((format as any) || 'json');
  });
}
