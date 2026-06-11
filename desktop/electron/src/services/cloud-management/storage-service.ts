import { CloudManagementBaseService } from './base-service.js';
// @ts-ignore
import type { StorageStats, StorageFile, CleanupSuggestion, CloudManagementError } from '@codepilot/core';

export interface CleanupParams {
  categories: string[];
  olderThanDays?: number;
}

export interface SearchFilesParams {
  query?: string;
  category?: string;
  sortBy?: 'name' | 'size' | 'modifiedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class StorageService extends CloudManagementBaseService {
  async getStorageStats(): Promise<StorageStats> {
    return this.request(() => this.client.get<StorageStats>('/storage/stats'));
  }
  
  async getFiles(params?: SearchFilesParams): Promise<{
    files: StorageFile[];
    total: number;
  }> {
    return this.request(() => this.client.get('/storage/files', {
      params
    }));
  }
  
  async getFile(fileId: string): Promise<StorageFile> {
    return this.request(() => this.client.get<StorageFile>(`/storage/files/${fileId}`));
  }
  
  async deleteFile(fileId: string): Promise<void> {
    return this.request(() => this.client.delete<void>(`/storage/files/${fileId}`));
  }
  
  async deleteFiles(fileIds: string[]): Promise<void> {
    return this.request(() => this.client.post<void>('/storage/files/delete', { fileIds }));
  }
  
  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    return this.request(() => this.client.get<ArrayBuffer>(`/storage/files/${fileId}/download`, {
      responseType: 'arraybuffer'
    }));
  }
  
  async getCleanupSuggestions(): Promise<CleanupSuggestion[]> {
    return this.request(() => this.client.get<CleanupSuggestion[]>('/storage/cleanup-suggestions'));
  }
  
  async performCleanup(params: CleanupParams): Promise<{
    cleanedSize: number;
    cleanedFiles: number;
  }> {
    return this.request(() => this.client.post('/storage/cleanup', params));
  }
  
  async exportData(dataTypes: string[]): Promise<{
    downloadUrl: string;
    expiresAt: string;
  }> {
    return this.request(() => this.client.post('/storage/export', { dataTypes }));
  }
  
  async importData(file: File): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(() => this.client.post('/storage/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }));
  }
  
  async getCategoryStats(): Promise<{
    category: string;
    size: number;
    count: number;
  }[]> {
    return this.request(() => this.client.get('/storage/category-stats'));
  }
}

export const storageService = new StorageService({
  baseUrl: 'https://ide.zhejiangjinmo.com/api'
});
