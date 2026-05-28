"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlidingWindowMemoryManager = void 0;
const types_js_1 = require("./types.js");
class SlidingWindowMemoryManager {
    config;
    eventBus = null;
    enabled = true;
    constructor(config) {
        this.config = { ...types_js_1.DEFAULT_SLIDING_WINDOW_CONFIG, ...config };
        this.enabled = this.config.enabled;
    }
    initialize(eventBus, _hookRegistry) {
        this.eventBus = eventBus;
    }
    compactWithSlidingWindow(messages, totalTokens) {
        if (!this.enabled || totalTokens <= this.config.windowUpperLimit) {
            const tokenEstimate = this.estimateTokens(messages);
            return {
                retainedMessages: messages,
                evictedMessages: [],
                evictedTokenCount: 0,
                retainedTokenCount: tokenEstimate,
            };
        }
        const totalLength = messages.length;
        const preserveStart = Math.max(0, totalLength - this.config.preserveRecentN);
        const scored = messages.map((message, index) => {
            const importance = this.calcImportance(message);
            const recency = totalLength > 1 ? index / (totalLength - 1) : 1;
            const score = importance * this.config.importanceWeight + recency * this.config.recencyWeight;
            const protected_ = index >= preserveStart;
            return { message, index, score, protected: protected_ };
        });
        const candidates = scored
            .filter((s) => !s.protected)
            .sort((a, b) => a.score - b.score);
        const evictedIndices = new Set();
        let currentTokens = totalTokens;
        for (const candidate of candidates) {
            if (currentTokens <= this.config.windowLowerLimit)
                break;
            const msgTokens = this.estimateSingleMessageTokens(candidate.message);
            evictedIndices.add(candidate.index);
            currentTokens -= msgTokens;
        }
        const retainedMessages = [];
        const evictedMessages = [];
        for (let i = 0; i < messages.length; i++) {
            if (evictedIndices.has(i)) {
                evictedMessages.push(messages[i]);
            }
            else {
                retainedMessages.push(messages[i]);
            }
        }
        const evictedTokenCount = totalTokens - currentTokens;
        this.eventBus?.publish('memory:window_compacted', {
            evictedCount: evictedMessages.length,
            retainedCount: retainedMessages.length,
            evictedTokenCount,
            retainedTokenCount: currentTokens,
        }, 'SlidingWindowMemoryManager');
        return {
            retainedMessages,
            evictedMessages,
            evictedTokenCount,
            retainedTokenCount: currentTokens,
        };
    }
    healthCheck() {
        return { healthy: this.enabled };
    }
    degrade() {
        this.enabled = false;
    }
    calcImportance(message) {
        if (message.role === 'tool' || message.toolName) {
            return 0.8;
        }
        return 0.3;
    }
    estimateSingleMessageTokens(message) {
        return Math.ceil(message.content.length / 4) + 10;
    }
    estimateTokens(messages) {
        return messages.reduce((sum, m) => sum + this.estimateSingleMessageTokens(m), 0);
    }
}
exports.SlidingWindowMemoryManager = SlidingWindowMemoryManager;
//# sourceMappingURL=sliding-window-manager.js.map