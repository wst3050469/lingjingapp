/**
 * 限流控制器
 * 创建时间: 2026-05-07
 * 版本: v1.0
 */
import { WorkflowLogger } from '../infrastructure/logger';
/**
 * 限流控制器
 */
export class RateLimiter {
    logger;
    tokens;
    maxTokens;
    refillRate;
    lastRefill;
    maxWaitTime;
    waitingQueue = [];
    constructor(config) {
        this.logger = new WorkflowLogger('rate-limiter');
        this.maxTokens = config.burstSize || config.requestsPerSecond;
        this.tokens = this.maxTokens;
        this.refillRate = config.requestsPerSecond;
        this.lastRefill = Date.now();
        this.maxWaitTime = config.maxWaitTime || 60000;
        this.startRefillTimer();
    }
    /**
     * 等待获取令牌
     */
    async waitForSlot() {
        this.refillTokens();
        if (this.tokens >= 1) {
            this.tokens--;
            return;
        }
        return new Promise((resolve, reject) => {
            const waitItem = {
                resolve,
                reject,
                addedAt: Date.now()
            };
            this.waitingQueue.push(waitItem);
            this.logger.debug(0, 'Rate limit: waiting for slot', {
                queueSize: this.waitingQueue.length
            });
        });
    }
    /**
     * 尝试获取令牌（非阻塞）
     */
    tryAcquire() {
        this.refillTokens();
        if (this.tokens >= 1) {
            this.tokens--;
            return true;
        }
        return false;
    }
    /**
     * 补充令牌
     */
    refillTokens() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const tokensToAdd = elapsed * this.refillRate;
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
        this.processWaitingQueue();
    }
    /**
     * 处理等待队列
     */
    processWaitingQueue() {
        while (this.waitingQueue.length > 0 && this.tokens >= 1) {
            const waitItem = this.waitingQueue.shift();
            if (!waitItem) {
                break;
            }
            const waitTime = Date.now() - waitItem.addedAt;
            if (waitTime > this.maxWaitTime) {
                waitItem.reject(new Error(`Rate limit wait time exceeded: ${waitTime}ms`));
                continue;
            }
            this.tokens--;
            waitItem.resolve();
        }
    }
    /**
     * 启动定时器
     */
    startRefillTimer() {
        setInterval(() => {
            this.refillTokens();
            this.checkTimeouts();
        }, 100);
    }
    /**
     * 检查超时
     */
    checkTimeouts() {
        const now = Date.now();
        while (this.waitingQueue.length > 0) {
            const waitItem = this.waitingQueue[0];
            const waitTime = now - waitItem.addedAt;
            if (waitTime > this.maxWaitTime) {
                this.waitingQueue.shift();
                waitItem.reject(new Error(`Rate limit wait time exceeded: ${waitTime}ms`));
            }
            else {
                break;
            }
        }
    }
    /**
     * 获取当前状态
     */
    getStatus() {
        this.refillTokens();
        return {
            availableTokens: Math.floor(this.tokens),
            maxTokens: this.maxTokens,
            queueSize: this.waitingQueue.length
        };
    }
    /**
     * 重置限流器
     */
    reset() {
        this.tokens = this.maxTokens;
        this.lastRefill = Date.now();
        while (this.waitingQueue.length > 0) {
            const waitItem = this.waitingQueue.shift();
            waitItem?.resolve();
        }
        this.logger.info(0, 'Rate limiter reset');
    }
}
//# sourceMappingURL=rate-limiter.js.map