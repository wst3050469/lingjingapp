import { CloudManagementBaseService } from './base-service.js';
// @ts-ignore
import type { CloudSyncStatus, CloudSyncRecord, CloudSyncConflict, CloudManagementError } from '@codepilot/core';

export interface SyncNowParams {
  dataTypes?: string[];
  force?: boolean;
}

export interface ResolveConflictParams {
  conflictId: string;
  resolution: 'local' | 'remote' | 'merged';
  mergedValue?: unknown;
}

export class SyncService extends CloudManagementBaseService {
  async getSyncStatus(): Promise<CloudSyncStatus> {
    return this.request(() => this.client.get<CloudSyncStatus>('/sync/status'));
  }
  
  async syncNow(params?: SyncNowParams): Promise<void> {
    return this.request(() => this.client.post<void>('/sync/now', params));
  }
  
  async pauseSync(): Promise<void> {
    return this.request(() => this.client.post<void>('/sync/pause'));
  }
  
  async resumeSync(): Promise<void> {
    return this.request(() => this.client.post<void>('/sync/resume'));
  }
  
  async getSyncHistory(limit: number = 50, offset: number = 0): Promise<CloudSyncRecord[]> {
    return this.request(() => this.client.get<CloudSyncRecord[]>('/sync/history', {
      params: { limit, offset }
    }));
  }
  
  async getConflicts(): Promise<CloudSyncConflict[]> {
    return this.request(() => this.client.get<CloudSyncConflict[]>('/sync/conflicts'));
  }
  
  async resolveConflict(params: ResolveConflictParams): Promise<void> {
    return this.request(() => this.client.post<void>(`/sync/conflicts/${params.conflictId}/resolve`, {
      resolution: params.resolution,
      mergedValue: params.mergedValue
    }));
  }
  
  async resolveAllConflicts(resolution: 'local' | 'remote'): Promise<void> {
    return this.request(() => this.client.post<void>('/sync/conflicts/resolve-all', { resolution }));
  }
  
  async getSyncSettings(): Promise<{
    enabled: boolean;
    autoSync: boolean;
    syncInterval: number;
    dataTypes: string[];
  }> {
    return this.request(() => this.client.get('/sync/settings'));
  }
  
  async updateSyncSettings(settings: {
    enabled?: boolean;
    autoSync?: boolean;
    syncInterval?: number;
    dataTypes?: string[];
  }): Promise<void> {
    return this.request(() => this.client.put<void>('/sync/settings', settings));
  }
  
  async getPendingChanges(): Promise<{ count: number; size: number }> {
    return this.request(() => this.client.get('/sync/pending'));
  }
}

export const syncService = new SyncService({
  baseUrl: 'https://www.spiritrealmz.com/api'
});
