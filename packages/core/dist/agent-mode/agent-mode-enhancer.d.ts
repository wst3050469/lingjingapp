import type { ExecutionPlan, ExecutionStep, AgentExecutionState, StepProgressEvent } from './types.js';
export declare class AgentModeEnhancer {
    private planPreviewer;
    private stepExecutor;
    private confirmationGate;
    private loopDetector;
    private executionInterrupter;
    private currentPlan;
    private state;
    constructor();
    previewPlan(instruction: string, steps: ExecutionStep[]): ExecutionPlan;
    executePlan(plan: ExecutionPlan, executor: (toolName: string, args: Record<string, unknown>) => Promise<string>, onProgress?: (event: StepProgressEvent) => void): Promise<ExecutionPlan>;
    interrupt(): void;
    confirmStep(stepId: string): void;
    rejectStep(stepId: string): void;
    getState(): AgentExecutionState;
    getPlan(): ExecutionPlan | null;
}
//# sourceMappingURL=agent-mode-enhancer.d.ts.map