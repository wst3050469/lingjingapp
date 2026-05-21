import type { IntentState, ActivityType } from './types.js';
export declare class IntentDetector {
    private activityMonitor;
    private modeClassifier;
    private currentState;
    private listeners;
    private debounceTimer;
    private readonly debounceMs;
    constructor(debounceMs?: number);
    recordActivity(type: ActivityType): void;
    getState(): IntentState;
    onChange(listener: (state: IntentState) => void): () => void;
    private scheduleUpdate;
    private updateState;
}
//# sourceMappingURL=intent-detector.d.ts.map