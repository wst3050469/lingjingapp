/**
 * 限流控制器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
/**
 * 限流配置
 */
export interface RateLimitConfig {
    requestsPerSecond: number;
    burstSize?: number;
    maxWaitTime?: number;
}
/**
 * 限流控制器
 */
export declare class RateLimiter {
    private logger;
    private tokens;
    private maxTokens;
    private refillRate;
    private lastRefill;
    private maxWaitTime;
    private waitingQueue;
    constructor(config: RateLimitConfig);
    /**
     * 等待获取令牌
     */
    waitForSlot(): Promise<void>;
    /**
     * 尝试获取令牌（非阻塞）
     */
    tryAcquire(): boolean;
    /**
     * 补充令牌
     */
    private refillTokens;
    /**
     * 处理等待队列
     */
    private processWaitingQueue;
    /**
     * 启动定时器
     */
    private startRefillTimer;
    /**
     * 检查超时
     */
    private checkTimeouts;
    /**
     * 获取当前状态
     */
    getStatus(): {
        availableTokens: number;
        maxTokens: number;
        queueSize: number;
    };
    /**
     * 重置限流器
     */
    reset(): void;
}
//# sourceMappingURL=rate-limiter.d.ts.map