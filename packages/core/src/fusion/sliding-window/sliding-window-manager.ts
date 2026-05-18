import type { IEventBus } from '../event-bus/types.js';
import type { IHookRegistry, HookPoint } from '../hook-registry/types.js';
import type { Message } from '../adapters/types.js';
import type { SlidingWindowConfig, CompactResult, ISlidingWindowMemoryManager } from './types.js';
import { DEFAULT_SLIDING_WINDOW_CONFIG } from './types.js';

interface ScoredMessage {
  message: Message;
  index: number;
  score: number;
  protected: boolean;
}

export class SlidingWindowMemoryManager implements ISlidingWindowMemoryManager {
  private config: SlidingWindowConfig;
  private eventBus: IEventBus | null = null;
  private enabled = true;

  constructor(config?: Partial<SlidingWindowConfig>) {
    this.config = { ...DEFAULT_SLIDING_WINDOW_CONFIG, ...config };
    this.enabled = this.config.enabled;
  }

  initialize(eventBus: IEventBus, _hookRegistry: IHookRegistry): void {
    this.eventBus = eventBus;
  }

  compactWithSlidingWindow(messages: Message[], totalTokens: number): CompactResult {
    if (!this.enabled || totalTokens <= this.config.windowUpperLimit) {
      const tokenEstimate = this.estimateTokens(messages);
      return {
        retainedMessages: messages,
        evictedMessages: [],
        evictedTokenCount: 0,
        retainedTokenCount: tokenEstimate,
      };
    }

    const totalLength = messages.length;
    const preserveStart = Math.max(0, totalLength - this.config.preserveRecentN);

    const scored: ScoredMessage[] = messages.map((message, index) => {
      const importance = this.calcImportance(message);
      const recency = totalLength > 1 ? index / (totalLength - 1) : 1;
      const score = importance * this.config.importanceWeight + recency * this.config.recencyWeight;
      const protected_ = index >= preserveStart;
      return { message, index, score, protected: protected_ };
    });

    const candidates = scored
      .filter((s) => !s.protected)
      .sort((a, b) => a.score - b.score);

    const evictedIndices = new Set<number>();
    let currentTokens = totalTokens;

    for (const candidate of candidates) {
      if (currentTokens <= this.config.windowLowerLimit) break;
      const msgTokens = this.estimateSingleMessageTokens(candidate.message);
      evictedIndices.add(candidate.index);
      currentTokens -= msgTokens;
    }

    const retainedMessages: Message[] = [];
    const evictedMessages: Message[] = [];

    for (let i = 0; i < messages.length; i++) {
      if (evictedIndices.has(i)) {
        evictedMessages.push(messages[i]);
      } else {
        retainedMessages.push(messages[i]);
      }
    }

    const evictedTokenCount = totalTokens - currentTokens;

    this.eventBus?.publish('memory:window_compacted', {
      evictedCount: evictedMessages.length,
      retainedCount: retainedMessages.length,
      evictedTokenCount,
      retainedTokenCount: currentTokens,
    }, 'SlidingWindowMemoryManager');

    return {
      retainedMessages,
      evictedMessages,
      evictedTokenCount,
      retainedTokenCount: currentTokens,
    };
  }

  healthCheck(): { healthy: boolean } {
    return { healthy: this.enabled };
  }

  degrade(): void {
    this.enabled = false;
  }

  private calcImportance(message: Message): number {
    if (message.role === 'tool' || message.toolName) {
      return 0.8;
    }
    return 0.3;
  }

  private estimateSingleMessageTokens(message: Message): number {
    return Math.ceil(message.content.length / 4) + 10;
  }

  private estimateTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + this.estimateSingleMessageTokens(m), 0);
  }
}
