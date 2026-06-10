import type { IEventBus } from '../event-bus/types.js';
import type { IHookRegistry } from '../hook-registry/types.js';
import type { Message } from '../adapters/types.js';
import type { SlidingWindowConfig, CompactResult, ISlidingWindowMemoryManager } from './types.js';
export declare class SlidingWindowMemoryManager implements ISlidingWindowMemoryManager {
    private config;
    private eventBus;
    private enabled;
    constructor(config?: Partial<SlidingWindowConfig>);
    initialize(eventBus: IEventBus, _hookRegistry: IHookRegistry): void;
    compactWithSlidingWindow(messages: Message[], totalTokens: number): CompactResult;
    healthCheck(): {
        healthy: boolean;
    };
    degrade(): void;
    private calcImportance;
    private estimateSingleMessageTokens;
    private estimateTokens;
}
//# sourceMappingURL=sliding-window-manager.d.ts.map