import type { IEventBus } from '../event-bus/types.js';
import type { ILLMAdapter } from '../adapters/types.js';
import type { ReviewConfig, ReviewReport, INudgeReviewEngine } from './types.js';
export declare class NudgeReviewEngine implements INudgeReviewEngine {
    private config;
    private eventBus;
    private llmAdapter;
    private quotaManager;
    private enabled;
    constructor(config?: Partial<ReviewConfig>);
    initialize(eventBus: IEventBus, llmAdapter: ILLMAdapter): void;
    startReview(messageId: string, content: string): Promise<ReviewReport | null>;
    healthCheck(): {
        healthy: boolean;
    };
    private executeReview;
    private parseReviewResponse;
}
//# sourceMappingURL=nudge-review-engine.d.ts.map