/**
 * Webhook触发器 - Webhook触发器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { TriggerConfig } from '../types';
import { BaseTrigger, TriggerCallback } from './base-trigger';
/**
 * Webhook配置
 */
export interface WebhookConfig {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    secret?: string;
    allowedOrigins?: string[];
    headers?: Record<string, string>;
    validateSignature?: boolean;
}
/**
 * Webhook请求
 */
export interface WebhookRequest {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: any;
    query?: Record<string, string>;
    timestamp: Date;
}
/**
 * Webhook验证结果
 */
export interface WebhookValidation {
    isValid: boolean;
    error?: string;
}
/**
 * Webhook触发器
 */
export declare class WebhookTrigger extends BaseTrigger {
    private logger;
    private callback?;
    private requestQueue;
    private isProcessing;
    private endpointPath?;
    constructor(config: TriggerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    setCallback(callback: TriggerCallback): void;
    /**
     * 处理Webhook请求
     */
    handleRequest(request: WebhookRequest): Promise<void>;
    /**
     * 匹配请求
     */
    private matchRequest;
    /**
     * 验证请求
     */
    private validateRequest;
    /**
     * 计算签名
     */
    private calculateSignature;
    /**
     * 处理请求队列
     */
    private processRequestQueue;
    /**
     * 获取端点路径
     */
    getEndpointPath(): string | undefined;
    /**
     * 获取队列长度
     */
    getQueueLength(): number;
    /**
     * 生成签名（测试兼容）
     */
    generateSignature(payload: string): string;
    /**
     * 验证签名（测试兼容）
     */
    validateSignature(payload: string, signature: string): boolean;
}
//# sourceMappingURL=webhook-trigger.d.ts.map