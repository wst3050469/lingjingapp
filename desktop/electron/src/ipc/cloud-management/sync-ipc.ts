import { ipcMain } from 'electron';
import { syncService } from '../../services/cloud-management/sync-service.js';
import type { SyncNowParams, ResolveConflictParams } from '../../services/cloud-management/sync-service.js';

export function registerSyncIpc(): void {
  ipcMain.handle('cloud:sync:getStatus', async () => {
    return syncService.getSyncStatus();
  });
  
  ipcMain.handle('cloud:sync:now', async (_event, params?: SyncNowParams) => {
    return syncService.syncNow(params);
  });
  
  ipcMain.handle('cloud:sync:pause', async () => {
    return syncService.pauseSync();
  });
  
  ipcMain.handle('cloud:sync:resume', async () => {
    return syncService.resumeSync();
  });
  
  ipcMain.handle('cloud:sync:getHistory', async (_event, limit?: number, offset?: number) => {
    return syncService.getSyncHistory(limit, offset);
  });
  
  ipcMain.handle('cloud:sync:getConflicts', async () => {
    return syncService.getConflicts();
  });
  
  ipcMain.handle('cloud:sync:resolveConflict', async (_event, params: ResolveConflictParams) => {
    return syncService.resolveConflict(params);
  });
  
  ipcMain.handle('cloud:sync:resolveAllConflicts', async (_event, resolution: 'local' | 'remote') => {
    return syncService.resolveAllConflicts(resolution);
  });
  
  ipcMain.handle('cloud:sync:getSettings', async () => {
    return syncService.getSyncSettings();
  });
  
  ipcMain.handle('cloud:sync:updateSettings', async (_event, settings) => {
    return syncService.updateSyncSettings(settings);
  });
  
  ipcMain.handle('cloud:sync:getPendingChanges', async () => {
    return syncService.getPendingChanges();
  });
}
