import { DAGOrchestrator } from '../../fusion/dag-orchestrator/dag-orchestrator.js';
import type { WorkflowRequirement, WorkflowState, ProgressInfo } from '../types.js';
export declare class WorkflowEngine {
    private orchestrator;
    private workflows;
    private listeners;
    constructor(orchestrator?: DAGOrchestrator);
    onProgress(workflowId: string, callback: (progress: ProgressInfo) => void): void;
    private emitProgress;
    startWorkflow(requirement: WorkflowRequirement): Promise<string>;
    private executeWorkflow;
    pauseWorkflow(): void;
    resumeWorkflow(): void;
    stopWorkflow(): void;
    listWorkflows(): WorkflowState[];
    getWorkflow(id: string): WorkflowState | undefined;
    private requirementToDAG;
}
//# sourceMappingURL=workflow-engine.d.ts.map