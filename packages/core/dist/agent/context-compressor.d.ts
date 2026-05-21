import type { Message } from './message-types.js';
export interface ContextBudget {
    systemLayerRatio: number;
    workingLayerRatio: number;
    historyLayerRatio: number;
    compactionTriggerRatio: number;
    maxContextTokens: number;
    workingWindowSize: number;
}
export declare const DEFAULT_CONTEXT_BUDGET: ContextBudget;
export interface ContextLayers {
    system: Message[];
    working: Message[];
    history: Message[];
}
export interface TokenBudgets {
    system: number;
    working: number;
    history: number;
    total: number;
}
export declare class ContextCompressor {
    private budget;
    constructor(budget?: Partial<ContextBudget>);
    shouldCompress(totalTokens: number): boolean;
    separateLayers(messages: Message[]): ContextLayers;
    calculateBudgets(): TokenBudgets;
    compress(messages: Message[], estimateTokens: (msgs: Message[]) => number): Message[];
    getBudget(): ContextBudget;
    updateBudget(updates: Partial<ContextBudget>): void;
}
//# sourceMappingURL=context-compressor.d.ts.map