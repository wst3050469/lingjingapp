import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionTraceHarvester } from '../trace-harvester/execution-trace-harvester.js';
import type { IEventBus } from '../event-bus/types.js';

describe('ExecutionTraceHarvester', () => {
  let harvester: ExecutionTraceHarvester;
  let eventBus: IEventBus;
  let handlers: Record<string, any>;

  beforeEach(() => {
    handlers = {};
    eventBus = {
      subscribe: vi.fn((topic: string, handler: any) => {
        handlers[topic] = handler;
        return vi.fn();
      }),
      publish: vi.fn(),
      unsubscribe: vi.fn(),
    } as unknown as IEventBus;
    harvester = new ExecutionTraceHarvester();
  });

  describe('constructor', () => {
    it('should use default config', () => {
      expect(harvester.healthCheck().healthy).toBe(true);
    });

    it('should accept custom config', () => {
      const custom = new ExecutionTraceHarvester({ enabled: false });
      expect(custom.healthCheck().healthy).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should subscribe to agent events', () => {
      harvester.initialize(eventBus);
      expect(eventBus.subscribe).toHaveBeenCalledWith('agent:tool_call', expect.any(Function));
      expect(eventBus.subscribe).toHaveBeenCalledWith('agent:tool_result', expect.any(Function));
      expect(eventBus.subscribe).toHaveBeenCalledWith('agent:message_end', expect.any(Function));
    });
  });

  describe('trace collection via event handlers', () => {
    beforeEach(() => {
      harvester.initialize(eventBus);
    });

    it('should collect tool calls via events', () => {
      handlers['agent:tool_call']({ data: { sessionId: 's1', toolName: 'search', parameters: { q: 'test' } } });
      handlers['agent:tool_result']({ data: { sessionId: 's1', result: 'found', duration: 100 } });

      const trace = harvester.collectTrace('s1');
      expect(trace).not.toBeNull();
      expect(trace?.toolCallSequence).toHaveLength(1);
      expect(trace?.toolCallSequence[0].toolName).toBe('search');
    });

    it('should collect multiple tool calls in sequence', () => {
      handlers['agent:tool_call']({ data: { sessionId: 's1', toolName: 'search', parameters: {} } });
      handlers['agent:tool_result']({ data: { sessionId: 's1', result: 'r1', duration: 50 } });
      handlers['agent:tool_call']({ data: { sessionId: 's1', toolName: 'read', parameters: {} } });
      handlers['agent:tool_result']({ data: { sessionId: 's1', result: 'r2', duration: 30 } });

      const trace = harvester.collectTrace('s1');
      expect(trace?.totalSteps).toBe(2);
    });

    it('should skip tool_result when no matching tool_call', () => {
      handlers['agent:tool_result']({ data: { sessionId: 's1', result: 'orphan', duration: 0 } });
      const trace = harvester.collectTrace('s1');
      expect(trace).toBeNull();
    });

    it('should return null for non-existent session', () => {
      expect(harvester.collectTrace('unknown')).toBeNull();
    });

    it('should start session tracking on first tool call', () => {
      handlers['agent:tool_call']({ data: { sessionId: 's1', toolName: 'search', parameters: {} } });
      handlers['agent:tool_result']({ data: { sessionId: 's1', result: 'ok', duration: 10 } });
      const trace = harvester.collectTrace('s1');
      expect(trace?.startTime).toBeGreaterThan(0);
      expect(trace?.endTime).toBeGreaterThan(0);
    });
  });

  describe('extractWorkflowPattern', () => {
    it('should detect repeating patterns', () => {
      const trace = {
        sessionId: 's1',
        toolCallSequence: [
          { toolName: 'search', parameters: {}, result: '', duration: 0, timestamp: 1 },
          { toolName: 'read', parameters: {}, result: '', duration: 0, timestamp: 2 },
          { toolName: 'search', parameters: {}, result: '', duration: 0, timestamp: 3 },
          { toolName: 'read', parameters: {}, result: '', duration: 0, timestamp: 4 },
        ],
        startTime: 0,
        endTime: 10,
        totalSteps: 4,
      };
      const patterns = harvester.extractWorkflowPattern(trace);
      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for no repeating patterns', () => {
      const trace = {
        sessionId: 's1',
        toolCallSequence: [
          { toolName: 'a', parameters: {}, result: '', duration: 0, timestamp: 1 },
          { toolName: 'b', parameters: {}, result: '', duration: 0, timestamp: 2 },
          { toolName: 'c', parameters: {}, result: '', duration: 0, timestamp: 3 },
        ],
        startTime: 0,
        endTime: 10,
        totalSteps: 3,
      };
      const patterns = harvester.extractWorkflowPattern(trace);
      expect(patterns).toHaveLength(0);
    });
  });

  describe('analyzeAndGenerateSkill', () => {
    beforeEach(() => {
      harvester.initialize(eventBus);
    });

    it('should return null when disabled', async () => {
      const disabled = new ExecutionTraceHarvester({ enabled: false });
      const result = await disabled.analyzeAndGenerateSkill('s1');
      expect(result).toBeNull();
    });

    it('should return null for insufficient tool calls', async () => {
      handlers['agent:tool_call']({ data: { sessionId: 's1', toolName: 'search', parameters: {} } });
      handlers['agent:tool_result']({ data: { sessionId: 's1', result: 'r', duration: 0 } });
      const result = await harvester.analyzeAndGenerateSkill('s1');
      expect(result).toBeNull();
    });

    it('should return null without LLM adapter', async () => {
      // Need enough tool calls but no LLM adapter
      for (let i = 0; i < 5; i++) {
        handlers['agent:tool_call']({ data: { sessionId: 's2', toolName: 't' + i, parameters: {} } });
        handlers['agent:tool_result']({ data: { sessionId: 's2', result: 'r', duration: 10 } });
      }
      const result = await harvester.analyzeAndGenerateSkill('s2');
      expect(result).toBeNull();
    });

    it('should publish skill:loaded event on success', async () => {
      const mockLLM = {
        chat: vi.fn().mockReturnValue({
          async *[Symbol.asyncIterator]() {
            yield { type: 'text_delta', text: '---\nname: test-skill\n---\nsome content' };
            yield { type: 'done' };
          }
        }),
      };
      const h = new ExecutionTraceHarvester({ minTraceDuration: 0, minToolCalls: 1 });
      const localHandlers: Record<string, any> = {};
      const localBus = {
        subscribe: vi.fn((topic: string, handler: any) => { localHandlers[topic] = handler; return vi.fn(); }),
        publish: vi.fn(),
        unsubscribe: vi.fn(),
      } as unknown as IEventBus;
      h.initialize(localBus, mockLLM as any);

      localHandlers['agent:tool_call']({ data: { sessionId: 's3', toolName: 'search', parameters: {} } });
      localHandlers['agent:tool_result']({ data: { sessionId: 's3', result: 'r', duration: 10 } });

      const result = await h.analyzeAndGenerateSkill('s3');
      expect(result).not.toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when enabled', () => {
      expect(harvester.healthCheck().healthy).toBe(true);
    });

    it('should return unhealthy when disabled', () => {
      const h = new ExecutionTraceHarvester({ enabled: false });
      expect(h.healthCheck().healthy).toBe(false);
    });
  });
});
