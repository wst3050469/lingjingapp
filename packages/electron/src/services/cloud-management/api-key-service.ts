import { CloudManagementBaseService } from './base-service.js';
// @ts-ignore
import type { ApiKey, ApiKeyStats, CloudManagementError } from '@codepilot/core';

export interface CreateApiKeyParams {
  name: string;
  permissions: string[];
  expiresAt?: string;
}

export interface UpdateApiKeyParams {
  name?: string;
  permissions?: string[];
  status?: 'active' | 'disabled';
}

export interface GetApiKeysParams {
  status?: 'active' | 'disabled' | 'expired';
  sortBy?: 'createdAt' | 'lastUsedAt' | 'callCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class ApiKeyService extends CloudManagementBaseService {
  async getApiKeys(params?: GetApiKeysParams): Promise<{
    keys: ApiKey[];
    total: number;
  }> {
    return this.request(() => this.client.get('/api-keys', {
      params
    }));
  }
  
  async getApiKey(keyId: string): Promise<ApiKey> {
    return this.request(() => this.client.get<ApiKey>(`/api-keys/${keyId}`));
  }
  
  async createApiKey(params: CreateApiKeyParams): Promise<ApiKey> {
    return this.request(() => this.client.post<ApiKey>('/api-keys', params));
  }
  
  async updateApiKey(keyId: string, params: UpdateApiKeyParams): Promise<ApiKey> {
    return this.request(() => this.client.put<ApiKey>(`/api-keys/${keyId}`, params));
  }
  
  async deleteApiKey(keyId: string): Promise<void> {
    return this.request(() => this.client.delete<void>(`/api-keys/${keyId}`));
  }
  
  async regenerateApiKey(keyId: string): Promise<ApiKey> {
    return this.request(() => this.client.post<ApiKey>(`/api-keys/${keyId}/regenerate`));
  }
  
  async toggleApiKeyStatus(keyId: string): Promise<ApiKey> {
    return this.request(() => this.client.post<ApiKey>(`/api-keys/${keyId}/toggle`));
  }
  
  async getApiKeyStats(): Promise<ApiKeyStats> {
    return this.request(() => this.client.get<ApiKeyStats>('/api-keys/stats'));
  }
  
  async getApiKeyUsageHistory(keyId: string, params?: {
    startDate?: string;
    endDate?: string;
    granularity?: 'hour' | 'day' | 'month';
  }): Promise<{
    timestamp: string;
    calls: number;
    errors: number;
  }[]> {
    return this.request(() => this.client.get(`/api-keys/${keyId}/usage`, {
      params
    }));
  }
  
  async testApiKey(keyId: string): Promise<{
    valid: boolean;
    responseTime: number;
    error?: string;
  }> {
    return this.request(() => this.client.post(`/api-keys/${keyId}/test`));
  }
  
  async getPermissions(): Promise<{
    id: string;
    name: string;
    description: string;
  }[]> {
    return this.request(() => this.client.get('/api-keys/permissions'));
  }
}

export const apiKeyService = new ApiKeyService({
  baseUrl: 'https://www.spiritrealmz.com/api'
});
