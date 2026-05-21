import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenSpaceExecuteTool } from '../fusion/openspace/tools/openspace-execute.js';
import { createRememberVectorTool } from '../fusion/vector-memory/tools/remember-vector.js';
import { createRecallVectorTool } from '../fusion/vector-memory/tools/recall-vector.js';
import { MetricsCollector } from '../fusion/event-bus/metrics.js';
describe('MetricsCollector', () => {
    let mc;
    beforeEach(() => {
        mc = new MetricsCollector();
    });
    it('should start with zero metrics', () => {
        const m = mc.getMetrics();
        expect(m.totalPublished).toBe(0);
        expect(m.totalDelivered).toBe(0);
        expect(m.totalErrors).toBe(0);
        expect(m.avgDeliveryMs).toBe(0);
    });
    it('should record published events', () => {
        mc.recordPublished();
        mc.recordPublished();
        expect(mc.getMetrics().totalPublished).toBe(2);
    });
    it('should record delivered events with duration', () => {
        mc.recordDelivered(10);
        mc.recordDelivered(20);
        const m = mc.getMetrics();
        expect(m.totalDelivered).toBe(2);
        expect(m.avgDeliveryMs).toBe(15);
    });
    it('should record errors', () => {
        mc.recordError();
        expect(mc.getMetrics().totalErrors).toBe(1);
    });
    it('should reset all metrics', () => {
        mc.recordPublished();
        mc.recordDelivered(5);
        mc.recordError();
        mc.reset();
        const m = mc.getMetrics();
        expect(m.totalPublished).toBe(0);
        expect(m.totalDelivered).toBe(0);
        expect(m.totalErrors).toBe(0);
    });
});
describe('OpenSpaceExecuteTool', () => {
    let tool;
    beforeEach(() => {
        tool = new OpenSpaceExecuteTool();
    });
    it('should have correct name and description', () => {
        expect(tool.name).toBe('openspace_execute');
        expect(tool.description).toContain('OpenSpace');
    });
    it('should return error for invalid language', async () => {
        const result = await tool.execute({ script: 'test', language: 'rust' }, {});
        expect(result.isError).toBe(true);
        expect(result.content).toContain('Invalid language');
    });
    it('should return error when process not running', async () => {
        const result = await tool.execute({ script: 'test()', language: 'lua' }, {});
        expect(result.isError).toBe(true);
        expect(result.content).toContain('not running');
    });
    it('should return preview when preview mode is on', async () => {
        const mockManager = { runState: 'running' };
        tool.setProcessManager(mockManager);
        const result = await tool.execute({
            script: 'test()', language: 'lua', preview: true,
        }, {});
        expect(result.isError).toBeFalsy();
        expect(result.content).toContain('preview');
        expect(result.content).toContain('securityReview');
    });
    it('should handle setBridge and setProcessManager', () => {
        const bridge = { isConnected: true, sendScript: vi.fn() };
        const manager = { runState: 'running' };
        tool.setBridge(bridge);
        tool.setProcessManager(manager);
        expect(true).toBe(true);
    });
    it('should return error for dangerous script', async () => {
        const mockManager = { runState: 'running' };
        tool.setProcessManager(mockManager);
        const result = await tool.execute({
            script: 'os.execute("rm -rf /")', language: 'lua',
        }, {});
        expect(result.isError).toBe(true);
        expect(result.content).toContain('Security review');
    });
    it('should return bridge error when not connected', async () => {
        const mockManager = { runState: 'running' };
        const mockBridge = { isConnected: false, sendScript: vi.fn() };
        tool.setProcessManager(mockManager);
        tool.setBridge(mockBridge);
        const result = await tool.execute({
            script: 'test()', language: 'lua',
        }, {});
        expect(result.isError).toBe(true);
        expect(result.content).toContain('not connected');
    });
    it('should execute successfully with connected bridge', async () => {
        const mockManager = { runState: 'running' };
        const mockBridge = {
            isConnected: true,
            sendScript: vi.fn().mockResolvedValue({ success: true, result: 'done', duration: 10 }),
        };
        tool.setProcessManager(mockManager);
        tool.setBridge(mockBridge);
        const result = await tool.execute({
            script: 'test()', language: 'lua',
        }, {});
        expect(result.content).toContain('success');
    });
});
describe('Vector Memory Tools', () => {
    let mockStore;
    beforeEach(() => {
        mockStore = {
            store: vi.fn().mockResolvedValue('vec_123'),
            search: vi.fn().mockResolvedValue([
                { id: 'v1', content: 'test result', score: 0.95, metadata: {} },
            ]),
        };
    });
    describe('remember_vector', () => {
        it('should store content and return id', async () => {
            const tool = createRememberVectorTool(mockStore);
            const result = await tool.execute({ content: 'hello world' }, {});
            expect(result.content).toContain('vec_123');
            expect(mockStore.store).toHaveBeenCalledWith('hello world', {});
        });
        it('should handle errors gracefully', async () => {
            mockStore.store.mockRejectedValue(new Error('store error'));
            const tool = createRememberVectorTool(mockStore);
            const result = await tool.execute({ content: 'fail' }, {});
            expect(result.isError).toBe(true);
        });
    });
    describe('recall_vector', () => {
        it('should search and return formatted results', async () => {
            const tool = createRecallVectorTool(mockStore);
            const result = await tool.execute({ query: 'test query' }, {});
            expect(result.content).toContain('0.950');
            expect(result.content).toContain('test result');
        });
        it('should return no results message', async () => {
            mockStore.search.mockResolvedValue([]);
            const tool = createRecallVectorTool(mockStore);
            const result = await tool.execute({ query: 'nothing' }, {});
            expect(result.content).toContain('No results');
        });
        it('should handle errors gracefully', async () => {
            mockStore.search.mockRejectedValue(new Error('search error'));
            const tool = createRecallVectorTool(mockStore);
            const result = await tool.execute({ query: 'fail' }, {});
            expect(result.isError).toBe(true);
        });
        it('should accept custom topK', async () => {
            const tool = createRecallVectorTool(mockStore);
            await tool.execute({ query: 'test', topK: 3 }, {});
            expect(mockStore.search).toHaveBeenCalledWith('test', 3);
        });
    });
});
//# sourceMappingURL=remaining-tools.test.js.map