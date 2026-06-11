import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMQuotaManager } from '../review-engine/llm-quota-manager.js';
import { NudgeReviewEngine } from '../review-engine/nudge-review-engine.js';
import type { IEventBus } from '../event-bus/types.js';
import type { ILLMAdapter } from '../adapters/types.js';

describe('LLMQuotaManager', () => {
  it('should acquire when under limit', () => {
    const qm = new LLMQuotaManager(3);
    expect(qm.acquire()).toBe(true);
    expect(qm.used).toBe(1);
    expect(qm.available).toBe(2);
  });

  it('should reject when at limit', () => {
    const qm = new LLMQuotaManager(1);
    expect(qm.acquire()).toBe(true);
    expect(qm.acquire()).toBe(false);
  });

  it('should release and free up slot', () => {
    const qm = new LLMQuotaManager(1);
    qm.acquire();
    qm.release();
    expect(qm.acquire()).toBe(true);
  });

  it('should not go negative on release', () => {
    const qm = new LLMQuotaManager(1);
    qm.release();
    qm.release();
    expect(qm.used).toBe(0);
  });
});

describe('NudgeReviewEngine', () => {
  let engine: NudgeReviewEngine;
  let eventBus: IEventBus;
  let llmAdapter: ILLMAdapter;
  let handlers: Record<string, any>;

  beforeEach(() => {
    handlers = {};
    eventBus = {
      subscribe: vi.fn((topic: string, handler: any) => { handlers[topic] = handler; return vi.fn(); }),
      publish: vi.fn(),
      unsubscribe: vi.fn(),
    } as unknown as IEventBus;
    llmAdapter = {
      chat: vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: 'text_delta', text: '{"score": 7, "suggestions": ["improve x"], "riskFlags": ["none"]}' };
          yield { type: 'done' };
        }
      }),
    } as unknown as ILLMAdapter;
    engine = new NudgeReviewEngine({ reviewTimeout: 5000 });
    engine.initialize(eventBus, llmAdapter);
  });

  describe('initialize', () => {
    it('should subscribe to agent:message_end', () => {
      expect(eventBus.subscribe).toHaveBeenCalledWith('agent:message_end', expect.any(Function));
    });

    it('should auto-start review on message_end event', async () => {
      handlers['agent:message_end']({ data: { messageId: 'm1', content: 'test code' } });
      // Wait for async handler
      await new Promise(r => setTimeout(r, 10));
      expect(llmAdapter.chat).toHaveBeenCalled();
    });
  });

  describe('startReview', () => {
    it('should return null when disabled', async () => {
      const disabled = new NudgeReviewEngine({ enabled: false });
      const result = await disabled.startReview('m1', 'code');
      expect(result).toBeNull();
    });

    it('should return null without LLM adapter', async () => {
      const noLLM = new NudgeReviewEngine();
      noLLM.initialize(eventBus, null as any);
      // Re-init without adapter by accessing private: initialize sets llmAdapter
      const result = await noLLM.startReview('m1', 'code');
      expect(result).toBeNull();
    });

    it('should return review report on success', async () => {
      const result = await engine.startReview('m1', 'some code');
      expect(result).not.toBeNull();
      expect(result?.score).toBe(7);
      expect(result?.suggestions).toContain('improve x');
      expect(result?.originalMessageId).toBe('m1');
    });

    it('should publish review:completed event', async () => {
      await engine.startReview('m1', 'code');
      expect(eventBus.publish).toHaveBeenCalledWith(
        'review:completed',
        expect.objectContaining({ originalMessageId: 'm1' }),
        'NudgeReviewEngine',
      );
    });

    it('should handle LLM errors gracefully', async () => {
      const badLLM = {
        chat: vi.fn().mockReturnValue({
          async *[Symbol.asyncIterator]() {
            throw new Error('LLM error');
          }
        }),
      } as unknown as ILLMAdapter;
      const e = new NudgeReviewEngine({ reviewTimeout: 5000 });
      e.initialize(eventBus, badLLM);
      const result = await e.startReview('m1', 'code');
      expect(result).toBeNull();
      expect(eventBus.publish).toHaveBeenCalledWith(
        'review:failed',
        expect.objectContaining({ messageId: 'm1' }),
        'NudgeReviewEngine',
      );
    });

    it('should parse review response from JSON', async () => {
      const result = await engine.startReview('m1', 'code');
      expect(result?.reviewId).toContain('review_');
      expect(result?.label).toBe('审查建议');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when LLM adapter is available', () => {
      expect(engine.healthCheck().healthy).toBe(true);
    });

    it('should return unhealthy without LLM adapter', () => {
      const e = new NudgeReviewEngine();
      expect(e.healthCheck().healthy).toBe(false);
    });
  });
});
