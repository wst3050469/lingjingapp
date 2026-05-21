/**
 * API Connector - 第三方API集成
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorConfig, ConnectorResult } from '../types';
import { BaseConnector, ConnectorOperation } from './base-connector';
/**
 * API配置
 */
export interface ApiConfig {
    baseUrl: string;
    authType: 'NONE' | 'API_KEY' | 'OAUTH2' | 'BASIC';
    authConfig?: {
        apiKey?: string;
        apiKeyHeader?: string;
        username?: string;
        password?: string;
        oauthToken?: string;
    };
    defaultHeaders?: Record<string, string>;
    rateLimit?: {
        requestsPerSecond: number;
        burstSize?: number;
    };
}
/**
 * API响应
 */
export interface ApiResponse {
    success: boolean;
    data?: any;
    error?: {
        code: string;
        message: string;
    };
    metadata?: {
        requestId?: string;
        timestamp?: string;
    };
}
/**
 * API Connector
 */
export declare class APIConnector extends BaseConnector {
    private logger;
    private apiConfig;
    private requestQueue;
    private requestTimes;
    constructor(config: ConnectorConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    execute(operation: ConnectorOperation): Promise<ConnectorResult>;
    healthCheck(): Promise<boolean>;
    /**
     * 验证配置（测试兼容）
     */
    validateConfig(config: Record<string, any>): boolean;
    private validateAuthentication;
    private buildHeaders;
    private applyRateLimit;
    private executeApiCall;
    private buildUrl;
    private delay;
}
//# sourceMappingURL=api-connector.d.ts.map