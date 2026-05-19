import { ipcMain } from 'electron';
// @ts-ignore - not in @codepilot/core exports
import { CloudSyncClient } from '@codepilot/core';
import type { DataType, OperationType, SyncProgress } from '@codepilot/core/types';

let cloudSyncClient: any = null;

export function initCloudSyncIpc(deviceId: string): void {
  // @ts-expect-error - constructor accepts string deviceId
    cloudSyncClient = new CloudSyncClient(deviceId);

  ipcMain.handle('cloud-sync:init', async () => {
    return { success: true, deviceId };
  });

  ipcMain.handle('cloud-sync:push', async (_event, dataType: DataType, operation: OperationType, payload: unknown) => {
    if (!cloudSyncClient) {
      throw new Error('CloudSyncClient not initialized');
    }
    return cloudSyncClient.pushData(dataType, operation, payload);
  });

  ipcMain.handle('cloud-sync:pull', async (_event, dataType: DataType, dataId: string) => {
    if (!cloudSyncClient) {
      throw new Error('CloudSyncClient not initialized');
    }
    return cloudSyncClient.pullData(dataType, dataId);
  });

  ipcMain.handle('cloud-sync:sync-now', async () => {
    if (!cloudSyncClient) {
      throw new Error('CloudSyncClient not initialized');
    }
    return cloudSyncClient.syncIncremental();
  });

  ipcMain.handle('cloud-sync:get-progress', async (): Promise<SyncProgress> => {
    if (!cloudSyncClient) {
      return { total: 0, completed: 0, failed: 0 };
    }
    return cloudSyncClient.getSyncProgress();
  });

  ipcMain.on('cloud-sync:subscribe', (event, channel: string) => {
    if (!cloudSyncClient) return;
    
    const handler = (data: any) => {
      event.sender.send(`cloud-sync:${channel}`, data);
    };
    
    cloudSyncClient.on(channel, handler);
    
    // @ts-expect-error - channel type mismatch
    event.sender.once('cloud-sync:unsubscribe', () => {
      cloudSyncClient?.off(channel, handler);
    });
  });
}

export function getCloudSyncClient(): CloudSyncClient | null {
  return cloudSyncClient;
}
