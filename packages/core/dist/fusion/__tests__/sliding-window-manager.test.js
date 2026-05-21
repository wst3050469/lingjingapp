import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlidingWindowMemoryManager } from '../sliding-window/sliding-window-manager.js';
describe('SlidingWindowMemoryManager', () => {
    let mgr;
    let eventBus;
    beforeEach(() => {
        eventBus = { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() };
        mgr = new SlidingWindowMemoryManager();
        mgr.initialize(eventBus, {});
    });
    function makeMsg(content, role = 'user', idx = 0) {
        return { content, role, toolName: undefined, id: `msg_${idx}`, createdAt: Date.now() + idx };
    }
    describe('constructor', () => {
        it('should use default config', () => {
            expect(mgr.healthCheck().healthy).toBe(true);
        });
        it('should accept custom config with smaller limit', () => {
            const custom = new SlidingWindowMemoryManager({
                windowUpperLimit: 50,
                windowLowerLimit: 10,
                preserveRecentN: 0,
            });
            const msgs = [
                makeMsg('a'.repeat(80), 'user', 0),
                makeMsg('b'.repeat(80), 'user', 1),
                makeMsg('c'.repeat(80), 'user', 2),
                makeMsg('d'.repeat(80), 'user', 3),
            ];
            // Each msg: ceil(80/4)+10 = 30 tokens, 4*30 = 120 > 50 (upper limit)
            // so compaction should evict some until tokens <= 10 (lower limit)
            const result = custom.compactWithSlidingWindow(msgs, 120);
            expect(result.retainedMessages.length).toBeLessThan(msgs.length);
        });
    });
    describe('compactWithSlidingWindow', () => {
        it('should return all messages when under token limit', () => {
            const msgs = [makeMsg('hello', 'user', 0), makeMsg('hi', 'assistant', 1)];
            const result = mgr.compactWithSlidingWindow(msgs, 10);
            expect(result.retainedMessages).toHaveLength(2);
            expect(result.evictedMessages).toHaveLength(0);
        });
        it('should evict least important messages when over limit', () => {
            const lowTokenLimit = new SlidingWindowMemoryManager({
                windowUpperLimit: 50,
                windowLowerLimit: 20,
                preserveRecentN: 1,
            });
            // Create messages with varying importance
            const msgs = [
                makeMsg('normal msg 0', 'user', 0),
                makeMsg('normal msg 1', 'user', 1),
                makeMsg('normal msg 2', 'user', 2),
                makeMsg('tool result', 'tool', 3), // higher importance (0.8 vs 0.3)
                makeMsg('recent msg', 'user', 4),
            ];
            const totalTokens = 100;
            const result = lowTokenLimit.compactWithSlidingWindow(msgs, totalTokens);
            expect(result.evictedMessages.length).toBeGreaterThan(0);
        });
        it('should preserve most recent N messages', () => {
            const strict = new SlidingWindowMemoryManager({
                windowUpperLimit: 30,
                windowLowerLimit: 10,
                preserveRecentN: 2,
            });
            const msgs = [
                makeMsg('old', 'user', 0),
                makeMsg('mid', 'user', 1),
                makeMsg('new', 'user', 2),
                makeMsg('newest', 'user', 3),
            ];
            const result = strict.compactWithSlidingWindow(msgs, 100);
            // The 2 newest should be preserved
            expect(result.retainedMessages).toContainEqual(expect.objectContaining({ content: 'newest' }));
        });
        it('should publish window_compacted event', () => {
            // Need totalTokens > windowUpperLimit to trigger compaction path
            const msgs = [makeMsg('x'.repeat(500), 'user', 0)];
            mgr.compactWithSlidingWindow(msgs, 150000);
            expect(eventBus.publish).toHaveBeenCalledWith('memory:window_compacted', expect.objectContaining({ evictedCount: 0 }), 'SlidingWindowMemoryManager');
        });
        it('should skip compaction when disabled', () => {
            const disabled = new SlidingWindowMemoryManager({ enabled: false });
            const msgs = [makeMsg('x', 'user', 0), makeMsg('y', 'user', 1)];
            const result = disabled.compactWithSlidingWindow(msgs, 999999);
            expect(result.retainedMessages).toHaveLength(2);
            expect(result.evictedMessages).toHaveLength(0);
        });
    });
    describe('calcImportance', () => {
        it('should score tool messages higher', () => {
            // Tested indirectly via compactWithSlidingWindow
            const lowLimit = new SlidingWindowMemoryManager({ windowUpperLimit: 30, preserveRecentN: 0 });
            const msgs = [
                makeMsg('user msg', 'user', 0),
                makeMsg('tool result', 'tool', 1),
            ];
            const result = lowLimit.compactWithSlidingWindow(msgs, 100);
            // Tool message (higher importance) should be retained over user message
            const toolRetained = result.retainedMessages.some(m => m.role === 'tool');
            expect(toolRetained).toBe(true);
        });
    });
    describe('healthCheck', () => {
        it('should return healthy when enabled', () => {
            expect(mgr.healthCheck().healthy).toBe(true);
        });
    });
    describe('degrade', () => {
        it('should set healthy to false', () => {
            mgr.degrade();
            expect(mgr.healthCheck().healthy).toBe(false);
        });
        it('should skip compaction after degrade', () => {
            mgr.degrade();
            const msgs = [makeMsg('a', 'user', 0), makeMsg('b', 'user', 1)];
            const result = mgr.compactWithSlidingWindow(msgs, 999999);
            expect(result.evictedMessages).toHaveLength(0);
        });
    });
    describe('estimateTokens', () => {
        it('should estimate tokens for a message', () => {
            // content length / 4 + 10
            const msgs = [makeMsg('hello', 'user', 0)]; // 5 chars → ceil(5/4)+10 = 12
            const result = mgr.compactWithSlidingWindow(msgs, 10);
            expect(result.retainedTokenCount).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=sliding-window-manager.test.js.map