import type { ExecutionStep, LoopDetectionRecord } from './types.js';
export declare class LoopDetector {
    private history;
    private readonly maxRepeats;
    constructor(maxRepeats?: number);
    check(step: ExecutionStep): LoopDetectionRecord | null;
    reset(): void;
}
//# sourceMappingURL=loop-detector.d.ts.map