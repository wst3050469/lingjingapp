/**
 * HTTP Connector - REST API调用
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
import { BaseConnector } from './base-connector';
/**
 * HTTP Connector
 */
export class HTTPConnector extends BaseConnector {
    logger;
    baseUrl;
    defaultHeaders;
    constructor(config) {
        super(config);
        this.logger = new WorkflowLogger(this.config.connectorId);
        this.baseUrl = this.config.config.baseUrl;
        this.defaultHeaders = this.config.config.defaultHeaders || {};
    }
    async connect() {
        this.logger.info(0, 'HTTP Connector connecting');
        if (this.baseUrl) {
            try {
                const response = await fetch(this.baseUrl, { method: 'HEAD' });
                this.isConnected = response.ok || response.status === 404;
            }
            catch (error) {
                this.isConnected = true;
                this.logger.warn(0, 'HTTP Connector connect check failed, assuming connected');
            }
        }
        else {
            this.isConnected = true;
        }
        this.logger.info(0, `HTTP Connector connected: ${this.isConnected}`);
    }
    async disconnect() {
        this.logger.info(0, 'HTTP Connector disconnecting');
        this.isConnected = false;
    }
    async execute(operation) {
        // Test compatibility: accept { method, path, body } format
        if ('method' in operation && !('operationType' in operation)) {
            const op = operation;
            operation = {
                operationType: op.method,
                parameters: {
                    method: op.method,
                    path: op.path,
                    body: op.body,
                    headers: op.headers
                }
            };
        }
        if (!this.isConnected) {
            return {
                success: false,
                error: new Error('HTTP Connector is not connected')
            };
        }
        const startTime = Date.now();
        try {
            const requestConfig = this.buildRequestConfig(operation);
            const response = await this.executeRequest(requestConfig);
            const duration = Date.now() - startTime;
            this.logger.info(0, 'HTTP request completed', {
                method: requestConfig.method,
                url: requestConfig.url,
                status: response.status,
                duration
            });
            return {
                success: response.status >= 200 && response.status < 300,
                data: response,
                metadata: {
                    duration,
                    status: response.status
                }
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(0, 'HTTP request failed', error);
            return {
                success: false,
                error: error,
                metadata: { duration }
            };
        }
    }
    async healthCheck() {
        if (!this.baseUrl) {
            return true;
        }
        try {
            const response = await fetch(this.baseUrl, { method: 'HEAD' });
            return response.ok || response.status === 404;
        }
        catch (error) {
            return false;
        }
    }
    buildRequestConfig(operation) {
        const { operationType, parameters } = operation;
        const config = {
            method: parameters.method || 'GET',
            url: this.buildUrl(parameters.path || '', parameters.query),
            headers: { ...this.defaultHeaders, ...parameters.headers },
            body: parameters.body,
            timeout: operation.options?.timeout || 30000
        };
        return config;
    }
    buildUrl(path, query) {
        let url = this.baseUrl ? `${this.baseUrl}${path}` : path;
        if (query) {
            const queryString = Object.entries(query)
                .filter(([_, value]) => value !== undefined && value !== null)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
            if (queryString) {
                url += `?${queryString}`;
            }
        }
        return url;
    }
    async executeRequest(config) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeout || 30000);
        try {
            const response = await fetch(config.url, {
                method: config.method,
                headers: config.headers,
                body: config.body ? JSON.stringify(config.body) : undefined,
                signal: controller.signal
            });
            clearTimeout(timeout);
            const headers = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });
            let data;
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await response.json();
            }
            else {
                data = await response.text();
            }
            return {
                status: response.status,
                statusText: response.statusText,
                headers,
                data
            };
        }
        catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }
}
//# sourceMappingURL=http-connector.js.map