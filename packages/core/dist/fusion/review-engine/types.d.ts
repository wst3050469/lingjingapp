export interface ReviewConfig {
    enabled: boolean;
    reviewModel: string;
    maxLLMConcurrency: number;
    reviewTimeout: number;
    scoreThreshold: number;
}
export interface ReviewReport {
    reviewId: string;
    originalMessageId: string;
    score: number;
    suggestions: string[];
    riskFlags: string[];
    reviewedAt: Date;
    label: '审查建议';
}
export interface INudgeReviewEngine {
    initialize(eventBus: import('../event-bus/types.js').IEventBus, llmAdapter: import('../adapters/types.js').ILLMAdapter): void;
    startReview(messageId: string, content: string): Promise<ReviewReport | null>;
    healthCheck(): {
        healthy: boolean;
    };
}
export declare const DEFAULT_REVIEW_CONFIG: ReviewConfig;
//# sourceMappingURL=types.d.ts.map