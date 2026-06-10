import { ipcMain } from 'electron';
import { storageService } from '../../services/cloud-management/storage-service.js';
import type { CleanupParams, SearchFilesParams } from '../../services/cloud-management/storage-service.js';

export function registerStorageIpc(): void {
  ipcMain.handle('cloud:storage:getStats', async () => {
    return storageService.getStorageStats();
  });
  
  ipcMain.handle('cloud:storage:getFiles', async (_event, params?: SearchFilesParams) => {
    return storageService.getFiles(params);
  });
  
  ipcMain.handle('cloud:storage:getFile', async (_event, fileId: string) => {
    return storageService.getFile(fileId);
  });
  
  ipcMain.handle('cloud:storage:deleteFile', async (_event, fileId: string) => {
    return storageService.deleteFile(fileId);
  });
  
  ipcMain.handle('cloud:storage:deleteFiles', async (_event, fileIds: string[]) => {
    return storageService.deleteFiles(fileIds);
  });
  
  ipcMain.handle('cloud:storage:downloadFile', async (_event, fileId: string) => {
    return storageService.downloadFile(fileId);
  });
  
  ipcMain.handle('cloud:storage:getCleanupSuggestions', async () => {
    return storageService.getCleanupSuggestions();
  });
  
  ipcMain.handle('cloud:storage:performCleanup', async (_event, params: CleanupParams) => {
    return storageService.performCleanup(params);
  });
  
  ipcMain.handle('cloud:storage:exportData', async (_event, dataTypes: string[]) => {
    return storageService.exportData(dataTypes);
  });
  
  ipcMain.handle('cloud:storage:importData', async (_event, file: File) => {
    return storageService.importData(file);
  });
  
  ipcMain.handle('cloud:storage:getCategoryStats', async () => {
    return storageService.getCategoryStats();
  });
}
