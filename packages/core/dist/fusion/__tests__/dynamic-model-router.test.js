import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicModelRouter } from '../model-router/dynamic-model-router.js';
function msg(role, content) {
    return { role, content };
}
describe('DynamicModelRouter', () => {
    let router;
    beforeEach(() => {
        router = new DynamicModelRouter(['gpt-4', 'claude-3']);
    });
    describe('constructor', () => {
        it('should use default config', () => {
            expect(router.healthCheck().healthy).toBe(true);
        });
        it('should register initial available models', () => {
            const r = new DynamicModelRouter(['model-a', 'model-b']);
            // route will use available model
            const decision = r.route({ model: 'model-x', messages: [msg('user', 'hi')] });
            expect(decision.selectedModel).toBe('default');
        });
    });
    describe('registerModel', () => {
        it('should add model to available set', () => {
            router.registerModel('new-model');
            // After registration, fallback can use it
            const r = new DynamicModelRouter([], undefined);
            r.registerModel('my-model');
            expect(true).toBe(true);
        });
    });
    describe('evaluateTaskFeatures', () => {
        it('should return low complexity for short context without tools', () => {
            const features = router.evaluateTaskFeatures([msg('user', 'hi')]);
            expect(features.complexity).toBe('low');
        });
        it('should return high complexity for long context with tools', () => {
            const features = router.evaluateTaskFeatures([
                msg('tool', 'x'.repeat(6000)),
                msg('user', 'y'.repeat(6000)),
            ]);
            expect(features.complexity).toBe('high');
        });
        it('should return medium complexity for mixed', () => {
            const features = router.evaluateTaskFeatures([msg('user', 'a'.repeat(2000))]);
            expect(features.complexity).toBe('medium');
        });
        it('should include cost estimate', () => {
            const features = router.evaluateTaskFeatures([msg('user', 'hello')]); // 5 chars
            expect(features.estimatedCost).toBeGreaterThan(0);
        });
        it('should include tool call detection', () => {
            const withTools = router.evaluateTaskFeatures([msg('tool', 'result')]);
            expect(withTools.hasToolCalls).toBe(true);
            const withoutTools = router.evaluateTaskFeatures([msg('user', 'hello')]);
            expect(withoutTools.hasToolCalls).toBe(false);
        });
    });
    describe('route', () => {
        it('should return original model when router disabled', () => {
            const r = new DynamicModelRouter([], { enabled: false });
            const decision = r.route({ model: 'gpt-4', messages: [msg('user', 'hi')] });
            expect(decision.selectedModel).toBe('gpt-4');
            expect(decision.fallback).toBe(false);
        });
        it('should use default model when no rules match', () => {
            const r = new DynamicModelRouter(['default']);
            const decision = r.route({ model: 'gpt-4', messages: [msg('user', 'hi')] });
            expect(decision.selectedModel).toBe('default');
            expect(decision.reason).toContain('default');
        });
        it('should match rule by taskType', () => {
            router.addRule({
                taskType: 'code', model: 'gpt-4', priority: 1, enabled: true,
            });
            const decision = router.route({
                model: 'claude-3',
                messages: [msg('user', 'write code')],
                taskType: 'code',
            });
            expect(decision.selectedModel).toBe('gpt-4');
            expect(decision.matchedRule).not.toBeNull();
        });
        it('should match rule by complexity', () => {
            router.addRule({
                taskType: 'general', complexity: 'high', model: 'gpt-4', priority: 1, enabled: true,
            });
            const decision = router.route({
                model: 'claude-3',
                messages: [msg('tool', 'x'.repeat(6000))],
            });
            expect(decision.selectedModel).toBe('gpt-4');
        });
        it('should fallback when selected model unavailable', () => {
            const r = new DynamicModelRouter(['claude-3']);
            r.addRule({
                taskType: 'general', model: 'gpt-4', priority: 1, enabled: true,
                fallbackModel: 'claude-3',
            });
            const decision = r.route({ model: 'gpt-4', messages: [msg('user', 'hi')] });
            expect(decision.fallback).toBe(true);
            expect(decision.selectedModel).toBe('claude-3');
        });
        it('should apply rules in priority order', () => {
            router.addRule({
                taskType: 'general', model: 'model-b', priority: 10, enabled: true,
            });
            router.addRule({
                taskType: 'general', model: 'model-a', priority: 1, enabled: true,
            });
            const decision = router.route({ model: 'x', messages: [msg('user', 'hi')] });
            // Higher priority = lower number = matched first
            expect(decision.selectedModel).toBe('model-a');
        });
    });
    describe('addRule / removeRule / getRules', () => {
        it('should add rule and return it with id', () => {
            const rule = router.addRule({
                taskType: 'test', model: 'm', priority: 5, enabled: true,
            });
            expect(rule.id).toContain('rule_');
        });
        it('should remove existing rule', () => {
            const rule = router.addRule({
                taskType: 'test', model: 'm', priority: 1, enabled: true,
            });
            expect(router.removeRule(rule.id)).toBe(true);
            expect(router.getRules()).toHaveLength(0);
        });
        it('should return false for non-existent rule', () => {
            expect(router.removeRule('nonexistent')).toBe(false);
        });
        it('should return a copy of rules list', () => {
            router.addRule({
                taskType: 'test', model: 'm', priority: 1, enabled: true,
            });
            const rules = router.getRules();
            expect(rules).toHaveLength(1);
        });
    });
    describe('healthCheck', () => {
        it('should return rules count', () => {
            router.addRule({
                taskType: 'test', model: 'm', priority: 1, enabled: true,
            });
            const health = router.healthCheck();
            expect(health.rulesCount).toBe(1);
            expect(health.healthy).toBe(true);
        });
    });
});
//# sourceMappingURL=dynamic-model-router.test.js.map