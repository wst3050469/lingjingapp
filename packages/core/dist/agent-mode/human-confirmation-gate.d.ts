import type { ExecutionStep } from './types.js';
export declare class HumanConfirmationGate {
    private pendingConfirmations;
    requireConfirmation(step: ExecutionStep): Promise<boolean>;
    confirm(stepId: string): void;
    reject(stepId: string): void;
    getPendingSteps(): ExecutionStep[];
}
//# sourceMappingURL=human-confirmation-gate.d.ts.map