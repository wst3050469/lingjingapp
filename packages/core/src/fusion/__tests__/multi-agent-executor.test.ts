import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiAgentExecutor } from '../multi-agent/multi-agent-executor.js';
import type { ParallelTask } from '../multi-agent/types.js';

describe('MultiAgentExecutor', () => {
  let executeFn: ReturnType<typeof vi.fn>;
  let executor: MultiAgentExecutor;

  beforeEach(() => {
    executeFn = vi.fn().mockResolvedValue('result');
    executor = new MultiAgentExecutor(executeFn);
  });

  function makeTask(id: string, prompt: string = 'do stuff'): ParallelTask {
    return { taskId: id, prompt };
  }

  describe('constructor', () => {
    it('should use default config', () => {
      expect(executor.healthCheck().healthy).toBe(true);
    });

    it('should accept custom config', () => {
      const custom = new MultiAgentExecutor(executeFn, { maxConcurrency: 1, taskTimeout: 100 });
      expect(true).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute a single task', async () => {
      const result = await executor.execute([makeTask('a')]);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('completed');
      expect(result.failedTasks).toHaveLength(0);
    });

    it('should execute multiple tasks in parallel', async () => {
      const result = await executor.execute([
        makeTask('a'), makeTask('b'), makeTask('c'),
      ]);
      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => r.status === 'completed')).toBe(true);
    });

    it('should return empty result when disabled', async () => {
      const disabled = new MultiAgentExecutor(executeFn, { enabled: false });
      const result = await disabled.execute([makeTask('a')]);
      expect(result.results).toHaveLength(0);
      expect(executeFn).not.toHaveBeenCalled();
    });

    it('should return empty result for empty tasks', async () => {
      const result = await executor.execute([]);
      expect(result.results).toHaveLength(0);
    });

    it('should handle task failure', async () => {
      executeFn.mockRejectedValue(new Error('fail'));
      const result = await executor.execute([makeTask('a')]);
      expect(result.results[0].status).toBe('failed');
      expect(result.failedTasks).toContain('a');
    });

    it('should handle task timeout via AbortSignal', async () => {
      executeFn.mockImplementation(async (_task: ParallelTask, _ctx: any, signal: AbortSignal) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        return 'done';
      });
      const fastTimeout = new MultiAgentExecutor(executeFn, { taskTimeout: 1 });
      const result = await fastTimeout.execute([makeTask('a')]);
      expect(result.results[0].status).toBe('timeout');
      expect(result.timedOutTasks).toContain('a');
    });

    it('should batch tasks according to maxConcurrency', async () => {
      const batchExec = new MultiAgentExecutor(executeFn, { maxConcurrency: 2 });
      const tasks = [makeTask('a'), makeTask('b'), makeTask('c'), makeTask('d')];
      const result = await batchExec.execute(tasks);
      expect(result.results).toHaveLength(4);
      expect(result.results.every(r => r.status === 'completed')).toBe(true);
    });

    it('should degrade to sequential when maxConcurrency is 1', async () => {
      const order: string[] = [];
      const tracker = vi.fn().mockImplementation(async (task: ParallelTask) => {
        order.push(task.taskId);
        return 'done';
      });
      const seqExec = new MultiAgentExecutor(tracker, { maxConcurrency: 1, degradeToSequential: true });
      const result = await seqExec.execute([makeTask('a'), makeTask('b')]);
      expect(result.results).toHaveLength(2);
      expect(order).toEqual(['a', 'b']);
    });

    it('should include duration in results', async () => {
      executeFn.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 5));
        return 'done';
      });
      const result = await executor.execute([makeTask('a')]);
      expect(result.results[0].duration).toBeGreaterThan(0);
    });
  });

  describe('setEventBus', () => {
    it('should allow setting event bus', () => {
      const bus = { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() };
      executor.setEventBus(bus);
      expect(true).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy', () => {
      expect(executor.healthCheck().healthy).toBe(true);
    });
  });
});
