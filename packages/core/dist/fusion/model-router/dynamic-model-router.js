"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicModelRouter = void 0;
const logger_js_1 = require("../../utils/logger.js");
const types_js_1 = require("./types.js");
class DynamicModelRouter {
    config;
    rules = [];
    eventBus = null;
    ruleCounter = 0;
    availableModels;
    healthy = true;
    constructor(availableModels = [], config, eventBus) {
        this.config = { ...types_js_1.DEFAULT_MODEL_ROUTER_CONFIG, ...config };
        this.availableModels = new Set(availableModels);
        if (eventBus)
            this.eventBus = eventBus;
    }
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
    registerModel(model) {
        this.availableModels.add(model);
    }
    evaluateTaskFeatures(messages, taskType) {
        const contextLength = messages.reduce((sum, m) => sum + m.content.length, 0);
        const hasToolCalls = messages.some((m) => m.role === 'tool');
        let complexity;
        if (contextLength < 1000 && !hasToolCalls) {
            complexity = 'low';
        }
        else if (contextLength > 5000 && hasToolCalls) {
            complexity = 'high';
        }
        else {
            complexity = 'medium';
        }
        const estimatedCost = contextLength * 0.00001 + (hasToolCalls ? 0.05 : 0);
        return {
            taskType: taskType ?? 'general',
            complexity,
            contextLength,
            hasToolCalls,
            estimatedCost,
        };
    }
    matchRule(features) {
        const enabledRules = this.rules
            .filter((r) => r.enabled)
            .sort((a, b) => a.priority - b.priority);
        for (const rule of enabledRules) {
            if (rule.taskType !== features.taskType)
                continue;
            if (rule.complexity !== undefined && rule.complexity !== features.complexity)
                continue;
            if (rule.costBudget !== undefined && features.estimatedCost > rule.costBudget)
                continue;
            return rule;
        }
        return null;
    }
    route(request) {
        if (!this.config.enabled) {
            return {
                requestId: this.generateId(),
                originalModel: request.model,
                selectedModel: request.model,
                matchedRule: null,
                reason: 'Router disabled',
                timestamp: Date.now(),
                fallback: false,
            };
        }
        const features = this.evaluateTaskFeatures(request.messages, request.taskType);
        const matchedRule = this.matchRule(features);
        let selectedModel;
        let reason;
        let fallback = false;
        if (matchedRule) {
            selectedModel = matchedRule.model;
            reason = `Matched rule ${matchedRule.id}: taskType=${matchedRule.taskType}`;
        }
        else {
            selectedModel = this.config.defaultModel;
            reason = 'No matching rule, using default model';
        }
        if (this.availableModels.size > 0 && !this.availableModels.has(selectedModel)) {
            const fallbackModel = matchedRule?.fallbackModel;
            if (fallbackModel && this.availableModels.has(fallbackModel)) {
                selectedModel = fallbackModel;
                reason += '; primary model unavailable, using fallback';
                fallback = true;
            }
            else if (this.availableModels.has(request.model)) {
                selectedModel = request.model;
                reason += '; selected model unavailable, falling back to original';
                fallback = true;
            }
            else if (this.availableModels.has(this.config.defaultModel)) {
                selectedModel = this.config.defaultModel;
                reason += '; falling back to default model';
                fallback = true;
            }
            if (fallback) {
                this.eventBus?.publish('model:fallback', { originalModel: request.model, selectedModel, reason }, 'DynamicModelRouter');
                logger_js_1.logger.info(`[DynamicModelRouter] model fallback: ${request.model} -> ${selectedModel}`);
            }
        }
        const decision = {
            requestId: this.generateId(),
            originalModel: request.model,
            selectedModel,
            matchedRule,
            reason,
            timestamp: Date.now(),
            fallback,
        };
        if (this.config.auditLogEnabled) {
            logger_js_1.logger.info(`[DynamicModelRouter] routing decision: ${JSON.stringify(decision)}`);
        }
        return decision;
    }
    addRule(rule) {
        const id = `rule_${++this.ruleCounter}_${Date.now()}`;
        const newRule = { ...rule, id };
        this.rules.push(newRule);
        return newRule;
    }
    removeRule(id) {
        const index = this.rules.findIndex((r) => r.id === id);
        if (index === -1)
            return false;
        this.rules.splice(index, 1);
        return true;
    }
    getRules() {
        return [...this.rules];
    }
    generateId() {
        return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    healthCheck() {
        return { healthy: this.healthy, rulesCount: this.rules.length };
    }
}
exports.DynamicModelRouter = DynamicModelRouter;
//# sourceMappingURL=dynamic-model-router.js.map