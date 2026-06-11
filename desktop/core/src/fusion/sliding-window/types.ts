import type { Message } from '../adapters/types.js';

export interface SlidingWindowConfig {
  enabled: boolean;
  windowUpperLimit: number;
  windowLowerLimit: number;
  preserveRecentN: number;
  importanceWeight: number;
  recencyWeight: number;
}

export interface CompactResult {
  retainedMessages: Message[];
  evictedMessages: Message[];
  evictedTokenCount: number;
  retainedTokenCount: number;
}

export interface ISlidingWindowMemoryManager {
  initialize(eventBus: import('../event-bus/types.js').IEventBus, hookRegistry: import('../hook-registry/types.js').IHookRegistry): void;
  compactWithSlidingWindow(messages: Message[], totalTokens: number): CompactResult;
  healthCheck(): { healthy: boolean };
  degrade(): void;
}

export const DEFAULT_SLIDING_WINDOW_CONFIG: SlidingWindowConfig = {
  enabled: true,
  windowUpperLimit: 120000,
  windowLowerLimit: 80000,
  preserveRecentN: 10,
  importanceWeight: 0.3,
  recencyWeight: 0.7,
};
