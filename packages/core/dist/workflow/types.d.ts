/** Workflow requirement for starting a new workflow */
export interface WorkflowRequirement {
    goal: string;
    context?: Record<string, unknown>;
    constraints?: string[];
    priority?: 'low' | 'normal' | 'high';
    model?: string;
}
/** Progress information emitted during workflow execution */
export interface ProgressInfo {
    workflowId: string;
    phase: string;
    progress: number;
    message: string;
    detail?: string;
}
/** Possible workflow statuses */
export declare enum WorkflowStatus {
    PENDING = "pending",
    RUNNING = "running",
    PAUSED = "paused",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
/** Full workflow state */
export interface WorkflowState {
    id: string;
    requirement: WorkflowRequirement;
    status: WorkflowStatus;
    createdAt: number;
    updatedAt: number;
    progress: number;
    result?: string;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map