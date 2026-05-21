export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting-confirmation';
export interface ExecutionStep {
    id: string;
    description: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    status: StepStatus;
    output?: string;
    startedAt?: Date;
    completedAt?: Date;
    isHighRisk: boolean;
}
export interface ExecutionPlan {
    id: string;
    instruction: string;
    steps: ExecutionStep[];
    createdAt: Date;
    totalSteps: number;
    completedSteps: number;
}
export type AgentExecutionState = 'planning' | 'previewing' | 'executing' | 'paused' | 'completed' | 'failed' | 'interrupted';
export interface LoopDetectionRecord {
    stepIndex: number;
    repeatCount: number;
    operationSignature: string;
}
export interface StepProgressEvent {
    stepId: string;
    status: StepStatus;
    output?: string;
    progress?: number;
}
//# sourceMappingURL=types.d.ts.map