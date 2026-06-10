import { ipcMain } from 'electron';
import { apiKeyService } from '../../services/cloud-management/api-key-service.js';
import type { CreateApiKeyParams, UpdateApiKeyParams, GetApiKeysParams } from '../../services/cloud-management/api-key-service.js';

export function registerApiKeyIpc(): void {
  ipcMain.handle('cloud:apiKey:getAll', async (_event, params?: GetApiKeysParams) => {
    return apiKeyService.getApiKeys(params);
  });
  
  ipcMain.handle('cloud:apiKey:get', async (_event, keyId: string) => {
    return apiKeyService.getApiKey(keyId);
  });
  
  ipcMain.handle('cloud:apiKey:create', async (_event, params: CreateApiKeyParams) => {
    return apiKeyService.createApiKey(params);
  });
  
  ipcMain.handle('cloud:apiKey:update', async (_event, keyId: string, params: UpdateApiKeyParams) => {
    return apiKeyService.updateApiKey(keyId, params);
  });
  
  ipcMain.handle('cloud:apiKey:delete', async (_event, keyId: string) => {
    return apiKeyService.deleteApiKey(keyId);
  });
  
  ipcMain.handle('cloud:apiKey:regenerate', async (_event, keyId: string) => {
    return apiKeyService.regenerateApiKey(keyId);
  });
  
  ipcMain.handle('cloud:apiKey:toggleStatus', async (_event, keyId: string) => {
    return apiKeyService.toggleApiKeyStatus(keyId);
  });
  
  ipcMain.handle('cloud:apiKey:getStats', async () => {
    return apiKeyService.getApiKeyStats();
  });
  
  ipcMain.handle('cloud:apiKey:getUsageHistory', async (_event, keyId: string, params?: { startDate?: string; endDate?: string; granularity?: 'hour' | 'day' | 'month' }) => {
    return apiKeyService.getApiKeyUsageHistory(keyId, params);
  });
  
  ipcMain.handle('cloud:apiKey:test', async (_event, keyId: string) => {
    return apiKeyService.testApiKey(keyId);
  });
  
  ipcMain.handle('cloud:apiKey:getPermissions', async () => {
    return apiKeyService.getPermissions();
  });
}
