import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryVectorAdapter } from '../fusion/vector-memory/adapters/in-memory-adapter.js';

describe('InMemoryVectorAdapter', () => {
  let adapter: InMemoryVectorAdapter;

  beforeEach(() => {
    adapter = new InMemoryVectorAdapter();
  });

  describe('initialize', () => {
    it('should resolve without error', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });
  });

  describe('upsert and search', () => {
    it('should store and retrieve by similarity', async () => {
      await adapter.upsert('a', [1, 0, 0], { content: 'apple' });
      await adapter.upsert('b', [0, 1, 0], { content: 'banana' });
      await adapter.upsert('c', [0, 0, 1], { content: 'cherry' });

      const results = await adapter.search([1, 0, 0], 2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('a');
      expect(results[0].score).toBeCloseTo(1, 1);
    });

    it('should return empty for empty store', async () => {
      const results = await adapter.search([1, 0, 0], 5);
      expect(results).toHaveLength(0);
    });

    it('should respect topK parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await adapter.upsert('v' + i, [i / 10, 0, 0], { content: 'v' + i });
      }
      const results = await adapter.search([1, 0, 0], 3);
      expect(results).toHaveLength(3);
    });

    it('should return content from metadata', async () => {
      await adapter.upsert('x', [1, 0], { content: 'test content' });
      const results = await adapter.search([1, 0], 1);
      expect(results[0].content).toBe('test content');
    });
  });

  describe('delete', () => {
    it('should remove an entry', async () => {
      await adapter.upsert('d', [1, 0], { content: 'delete me' });
      await adapter.delete('d');
      const results = await adapter.search([1, 0], 5);
      expect(results).toHaveLength(0);
    });

    it('should not throw for non-existent id', async () => {
      await expect(adapter.delete('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', async () => {
      await adapter.upsert('same', [0.5, 0.5], { content: '' });
      const results = await adapter.search([0.5, 0.5], 1);
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', async () => {
      await adapter.upsert('x', [1, 0], { content: '' });
      const results = await adapter.search([0, 1], 1);
      expect(results[0].score).toBeCloseTo(0, 5);
    });
  });
});

describe('Logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export a logger object with standard methods', async () => {
    const { logger } = await import('../utils/logger.js');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should call console.info on logger.info', async () => {
    const { logger } = await import('../utils/logger.js');
    logger.info('test message');
    expect(console.info).toHaveBeenCalled();
  });

  it('should call console.error on logger.error', async () => {
    const { logger } = await import('../utils/logger.js');
    logger.error('error message');
    expect(console.error).toHaveBeenCalled();
  });
});
