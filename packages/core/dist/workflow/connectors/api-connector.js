/**
 * API Connector - 第三方API集成
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
import { BaseConnector } from './base-connector';
/**
 * API Connector
 */
export class APIConnector extends BaseConnector {
    logger;
    apiConfig;
    requestQueue = [];
    requestTimes = [];
    constructor(config) {
        super(config);
        this.logger = new WorkflowLogger(this.config.connectorId);
        this.apiConfig = this.config.config;
    }
    async connect() {
        this.logger.info(0, 'API Connector connecting', {
            baseUrl: this.apiConfig.baseUrl,
            authType: this.apiConfig.authType
        });
        if (this.apiConfig.authType !== 'NONE') {
            const isValid = await this.validateAuthentication();
            if (!isValid) {
                throw new Error('API authentication validation failed');
            }
        }
        this.isConnected = true;
        this.logger.info(0, 'API Connector connected');
    }
    async disconnect() {
        this.logger.info(0, 'API Connector disconnecting');
        this.isConnected = false;
    }
    async execute(operation) {
        if (!this.isConnected) {
            return {
                success: false,
                error: new Error('API Connector is not connected')
            };
        }
        await this.applyRateLimit();
        const startTime = Date.now();
        try {
            const { operationType, parameters } = operation;
            const response = await this.executeApiCall(operationType, parameters);
            const duration = Date.now() - startTime;
            this.logger.info(0, 'API call completed', {
                operation: operationType,
                success: response.success,
                duration
            });
            return {
                success: response.success,
                data: response.data,
                error: response.error ? new Error(response.error.message) : undefined,
                metadata: {
                    duration,
                    ...response.metadata
                }
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(0, 'API call failed', error);
            return {
                success: false,
                error: error,
                metadata: { duration }
            };
        }
    }
    async healthCheck() {
        if (!this.isConnected) {
            return false;
        }
        try {
            const response = await fetch(this.apiConfig.baseUrl, {
                method: 'HEAD',
                headers: this.buildHeaders()
            });
            return response.ok || response.status === 404;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * 验证配置（测试兼容）
     */
    validateConfig(config) {
        return !!(config.apiKey || config.provider);
    }
    async validateAuthentication() {
        this.logger.info(0, 'Validating API authentication');
        switch (this.apiConfig.authType) {
            case 'API_KEY':
                return !!this.apiConfig.authConfig?.apiKey;
            case 'OAUTH2':
                return !!this.apiConfig.authConfig?.oauthToken;
            case 'BASIC':
                return !!(this.apiConfig.authConfig?.username &&
                    this.apiConfig.authConfig?.password);
            default:
                return true;
        }
    }
    buildHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            ...this.apiConfig.defaultHeaders
        };
        switch (this.apiConfig.authType) {
            case 'API_KEY':
                const headerName = this.apiConfig.authConfig?.apiKeyHeader || 'X-API-Key';
                headers[headerName] = this.apiConfig.authConfig?.apiKey || '';
                break;
            case 'OAUTH2':
                headers['Authorization'] = `Bearer ${this.apiConfig.authConfig?.oauthToken}`;
                break;
            case 'BASIC':
                const credentials = Buffer.from(`${this.apiConfig.authConfig?.username}:${this.apiConfig.authConfig?.password}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
                break;
        }
        return headers;
    }
    async applyRateLimit() {
        if (!this.apiConfig.rateLimit) {
            return;
        }
        const now = Date.now();
        const windowStart = now - 1000;
        while (this.requestTimes.length > 0 &&
            this.requestTimes[0] < windowStart) {
            this.requestTimes.shift();
        }
        const maxRequests = this.apiConfig.rateLimit.burstSize ||
            this.apiConfig.rateLimit.requestsPerSecond;
        if (this.requestTimes.length >= maxRequests) {
            const waitTime = 1000 - (now - this.requestTimes[0]);
            await this.delay(waitTime);
        }
        this.requestTimes.push(now);
    }
    async executeApiCall(operationType, parameters) {
        const url = this.buildUrl(operationType, parameters);
        const headers = this.buildHeaders();
        const response = await fetch(url, {
            method: parameters.method || 'GET',
            headers,
            body: parameters.body ? JSON.stringify(parameters.body) : undefined
        });
        let data;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await response.json();
        }
        else {
            data = await response.text();
        }
        if (!response.ok) {
            return {
                success: false,
                error: {
                    code: response.status.toString(),
                    message: response.statusText
                },
                data
            };
        }
        return {
            success: true,
            data,
            metadata: {
                requestId: response.headers.get('x-request-id') || undefined,
                timestamp: new Date().toISOString()
            }
        };
    }
    buildUrl(operationType, parameters) {
        let url = this.apiConfig.baseUrl;
        if (parameters.path) {
            url = `${url}/${parameters.path}`;
        }
        if (parameters.query) {
            const queryString = Object.entries(parameters.query)
                .filter(([_, value]) => value !== undefined && value !== null)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
                .join('&');
            if (queryString) {
                url += `?${queryString}`;
            }
        }
        return url;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=api-connector.js.map