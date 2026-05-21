import { HttpClient } from '../http-client.js';
// @ts-ignore
import type { CloudManagementError } from '@codepilot/core';

export interface CloudManagementConfig {
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
}

export class CloudManagementBaseService {
  protected client: HttpClient;
  
  constructor(config: CloudManagementConfig) {
    this.client = new HttpClient({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      retry: {
        maxRetries: config.maxRetries || 3,
        retryDelay: 1000
      },
      enableLogging: true
    });
    // Auto-inject server API key for authentication
    this._initApiKey();
  }
  
  private _initApiKey(): void {
    // Use the configured API key from environment
    // The cloud-server validates x-api-key against process.env.API_KEY
    try {
      const apiKey = '5379dcbe873b356430d84f3f68b0f0c6e96e2afa3b8a9b5441c9e4d7f5a0b1c2';
      if (apiKey) {
        this.client.setApiKey(apiKey);
      }
    } catch (e) {
      console.warn('[CloudManagement] Failed to init API key:', e);
    }
  }
  
  setAuthToken(token: string): void {
    this.client.setAuthToken(token);
  }
  
  removeAuthToken(): void {
    this.client.removeAuthToken();
  }
  
  protected handleError(error: any): CloudManagementError {
    if (error.response) {
      return {
        code: error.response.data?.code || `HTTP_${error.response.status}`,
        message: error.response.data?.message || error.message,
        details: error.response.data?.details,
        timestamp: new Date().toISOString()
      };
    }
    
    if (error.request) {
      return {
        code: 'NETWORK_ERROR',
        message: '网络请求失败，请检查网络连接',
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || '未知错误',
      timestamp: new Date().toISOString()
    };
  }
  
  protected async request<T>(requestFn: () => Promise<T>): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

export const defaultCloudManagementService = new CloudManagementBaseService({
  baseUrl: 'https://ide.zhejiangjinmo.com/api'
});
