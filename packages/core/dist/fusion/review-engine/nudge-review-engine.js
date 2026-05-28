"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NudgeReviewEngine = void 0;
const types_js_1 = require("./types.js");
const llm_quota_manager_js_1 = require("./llm-quota-manager.js");
const REVIEW_SYSTEM_PROMPT = `You are a code review assistant. Review the following content and provide:
1. A quality score from 0 to 10
2. Specific improvement suggestions
3. Any risk flags

Respond in this exact JSON format:
{"score": <number>, "suggestions": [<string>], "riskFlags": [<string>]}`;
class NudgeReviewEngine {
    config;
    eventBus = null;
    llmAdapter = null;
    quotaManager;
    enabled = true;
    constructor(config) {
        this.config = { ...types_js_1.DEFAULT_REVIEW_CONFIG, ...config };
        this.enabled = this.config.enabled;
        this.quotaManager = new llm_quota_manager_js_1.LLMQuotaManager(this.config.maxLLMConcurrency);
    }
    initialize(eventBus, llmAdapter) {
        this.eventBus = eventBus;
        this.llmAdapter = llmAdapter;
        this.eventBus.subscribe('agent:message_end', async (event) => {
            const data = event.data;
            if (data.messageId && data.content) {
                this.startReview(data.messageId, data.content).catch(() => { });
            }
        });
    }
    async startReview(messageId, content) {
        if (!this.enabled || !this.llmAdapter || !this.eventBus) {
            return null;
        }
        if (!this.quotaManager.acquire()) {
            return null;
        }
        try {
            const report = await this.executeReview(messageId, content);
            if (report) {
                this.eventBus.publish('review:completed', report, 'NudgeReviewEngine');
            }
            return report;
        }
        catch (err) {
            this.eventBus.publish('review:failed', {
                messageId,
                error: err.message,
            }, 'NudgeReviewEngine');
            return null;
        }
        finally {
            this.quotaManager.release();
        }
    }
    healthCheck() {
        return { healthy: this.enabled && this.llmAdapter !== null };
    }
    async executeReview(messageId, content) {
        if (!this.llmAdapter)
            return null;
        const messages = [
            { role: 'user', content },
        ];
        const request = {
            messages,
            systemPrompt: REVIEW_SYSTEM_PROMPT,
            maxTokens: 1024,
            temperature: 0.3,
        };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.reviewTimeout);
        let responseText = '';
        try {
            const stream = this.llmAdapter.chat({ ...request, signal: controller.signal });
            for await (const event of stream) {
                if (event.type === 'text_delta') {
                    responseText += event.text;
                }
                if (event.type === 'done')
                    break;
            }
        }
        finally {
            clearTimeout(timeoutId);
        }
        return this.parseReviewResponse(messageId, responseText);
    }
    parseReviewResponse(messageId, responseText) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                return null;
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                reviewId: `review_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                originalMessageId: messageId,
                score: typeof parsed.score === 'number' ? parsed.score : 0,
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
                riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [],
                reviewedAt: new Date(),
                label: '审查建议',
            };
        }
        catch {
            return null;
        }
    }
}
exports.NudgeReviewEngine = NudgeReviewEngine;
//# sourceMappingURL=nudge-review-engine.js.map