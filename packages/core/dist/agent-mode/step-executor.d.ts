import type { ExecutionStep, StepProgressEvent } from './types.js';
export declare class StepExecutor {
    private onProgress;
    setProgressHandler(handler: (event: StepProgressEvent) => void): void;
    executeStep(step: ExecutionStep, executor: (toolName: string, args: Record<string, unknown>) => Promise<string>): Promise<ExecutionStep>;
}
//# sourceMappingURL=step-executor.d.ts.map