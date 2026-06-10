/**
 * HTTP Connector - REST API调用
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { ConnectorConfig, ConnectorResult } from '../types';
import { BaseConnector, ConnectorOperation } from './base-connector';
/**
 * HTTP请求配置
 */
export interface HttpRequestConfig {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    retryCount?: number;
}
/**
 * HTTP响应
 */
export interface HttpResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
}
/**
 * HTTP Connector
 */
export declare class HTTPConnector extends BaseConnector {
    private logger;
    private baseUrl?;
    private defaultHeaders;
    constructor(config: ConnectorConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    execute(operation: ConnectorOperation | {
        method: string;
        path: string;
        body?: any;
        headers?: Record<string, string>;
    }): Promise<ConnectorResult>;
    healthCheck(): Promise<boolean>;
    private buildRequestConfig;
    private buildUrl;
    private executeRequest;
}
//# sourceMappingURL=http-connector.d.ts.map