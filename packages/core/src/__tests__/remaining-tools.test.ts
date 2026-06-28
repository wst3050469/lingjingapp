import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRememberVectorTool } from '../fusion/vector-memory/tools/remember-vector.js';
import { createRecallVectorTool } from '../fusion/vector-memory/tools/recall-vector.js';
import { MetricsCollector } from '../fusion/event-bus/metrics.js';

describe('MetricsCollector', () => {
  let mc: MetricsCollector;

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

describe('Vector Memory Tools', () => {
  let mockStore: any;

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
      const result = await tool.execute({ content: 'hello world' }, {} as any);
      expect(result.content).toContain('vec_123');
      expect(mockStore.store).toHaveBeenCalledWith('hello world', {});
    });

    it('should handle errors gracefully', async () => {
      mockStore.store.mockRejectedValue(new Error('store error'));
      const tool = createRememberVectorTool(mockStore);
      const result = await tool.execute({ content: 'fail' }, {} as any);
      expect(result.isError).toBe(true);
    });
  });

  describe('recall_vector', () => {
    it('should search and return formatted results', async () => {
      const tool = createRecallVectorTool(mockStore);
      const result = await tool.execute({ query: 'test query' }, {} as any);
      expect(result.content).toContain('0.950');
      expect(result.content).toContain('test result');
    });

    it('should return no results message', async () => {
      mockStore.search.mockResolvedValue([]);
      const tool = createRecallVectorTool(mockStore);
      const result = await tool.execute({ query: 'nothing' }, {} as any);
      expect(result.content).toContain('No results');
    });

    it('should handle errors gracefully', async () => {
      mockStore.search.mockRejectedValue(new Error('search error'));
      const tool = createRecallVectorTool(mockStore);
      const result = await tool.execute({ query: 'fail' }, {} as any);
      expect(result.isError).toBe(true);
    });

    it('should accept custom topK', async () => {
      const tool = createRecallVectorTool(mockStore);
      await tool.execute({ query: 'test', topK: 3 }, {} as any);
      expect(mockStore.search).toHaveBeenCalledWith('test', 3);
    });
  });
});
