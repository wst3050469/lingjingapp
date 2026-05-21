/**
 * Webhook触发器 - Webhook触发器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerType } from '../types';
import { WorkflowLogger } from '../infrastructure/logger';
import { BaseTrigger } from './base-trigger';
/**
 * Webhook触发器
 */
export class WebhookTrigger extends BaseTrigger {
    logger;
    callback;
    requestQueue = [];
    isProcessing = false;
    endpointPath;
    constructor(config) {
        super(config);
        this.logger = new WorkflowLogger(this.getId());
    }
    async start() {
        this.logger.info(0, 'Webhook trigger starting');
        const webhookConfig = this.config;
        this.endpointPath = webhookConfig.path;
        this.isActive = true;
        this.logger.info(0, 'Webhook trigger started', {
            path: webhookConfig.path,
            method: webhookConfig.method
        });
    }
    async stop() {
        this.logger.info(0, 'Webhook trigger stopping');
        this.endpointPath = undefined;
        this.isActive = false;
        this.logger.info(0, 'Webhook trigger stopped');
    }
    setCallback(callback) {
        this.callback = callback;
    }
    /**
     * 处理Webhook请求
     */
    async handleRequest(request) {
        if (!this.isActive) {
            this.logger.warn(0, 'Webhook trigger is not active');
            return;
        }
        const webhookConfig = this.config;
        if (!this.matchRequest(request, webhookConfig)) {
            this.logger.warn(0, 'Webhook request does not match config', {
                method: request.method,
                path: request.path
            });
            return;
        }
        const validation = this.validateRequest(request, webhookConfig);
        if (!validation.isValid) {
            this.logger.warn(0, 'Webhook request validation failed', {
                error: validation.error
            });
            return;
        }
        this.requestQueue.push(request);
        if (!this.isProcessing) {
            await this.processRequestQueue();
        }
    }
    /**
     * 匹配请求
     */
    matchRequest(request, config) {
        if (request.method !== config.method) {
            return false;
        }
        if (!request.path.startsWith(config.path)) {
            return false;
        }
        return true;
    }
    /**
     * 验证请求
     */
    validateRequest(request, config) {
        if (config.allowedOrigins && config.allowedOrigins.length > 0) {
            const origin = request.headers['origin'] || request.headers['Origin'];
            if (!origin || !config.allowedOrigins.includes(origin)) {
                return {
                    isValid: false,
                    error: `Origin ${origin} is not allowed`
                };
            }
        }
        if (config.validateSignature && config.secret) {
            const signature = request.headers['x-hub-signature'] ||
                request.headers['X-Hub-Signature'];
            if (!signature) {
                return {
                    isValid: false,
                    error: 'Missing signature header'
                };
            }
            const expectedSignature = this.calculateSignature(JSON.stringify(request.body), config.secret);
            if (signature !== `sha1=${expectedSignature}`) {
                return {
                    isValid: false,
                    error: 'Invalid signature'
                };
            }
        }
        if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
                if (request.headers[key.toLowerCase()] !== value) {
                    return {
                        isValid: false,
                        error: `Header ${key} mismatch`
                    };
                }
            }
        }
        return { isValid: true };
    }
    /**
     * 计算签名
     */
    calculateSignature(payload, secret) {
        let hash = 0;
        for (let i = 0; i < payload.length; i++) {
            const char = payload.charCodeAt(i);
            hash = ((hash << 5) - hash) + char + secret.charCodeAt(i % secret.length);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    /**
     * 处理请求队列
     */
    async processRequestQueue() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            if (!request || !this.callback) {
                continue;
            }
            try {
                await this.callback(this.getId(), TriggerType.WEBHOOK, {
                    method: request.method,
                    path: request.path,
                    headers: request.headers,
                    body: request.body,
                    query: request.query,
                    timestamp: request.timestamp
                });
                this.logger.info(0, 'Webhook request processed', {
                    method: request.method,
                    path: request.path
                });
            }
            catch (error) {
                this.logger.error(0, 'Webhook processing failed', error);
            }
        }
        this.isProcessing = false;
    }
    /**
     * 获取端点路径
     */
    getEndpointPath() {
        return this.endpointPath;
    }
    /**
     * 获取队列长度
     */
    getQueueLength() {
        return this.requestQueue.length;
    }
    // ===== 测试兼容方法 =====
    /**
     * 生成签名（测试兼容）
     */
    generateSignature(payload) {
        return this.calculateSignature(payload, this.config.secret || 'default-secret');
    }
    /**
     * 验证签名（测试兼容）
     */
    validateSignature(payload, signature) {
        const expected = this.calculateSignature(payload, this.config.secret || 'default-secret');
        return signature === expected || signature === `sha1=${expected}`;
    }
}
//# sourceMappingURL=webhook-trigger.js.map