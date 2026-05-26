import type { PipelineDefinition, PipelineRun, PipelineLogEvent } from './types.js';
export interface EngineCallbacks {
    onStatusChange?: (runId: string, status: string) => void;
    onLog?: (event: PipelineLogEvent) => void;
    onDangerousCommand?: (command: string) => Promise<boolean>;
}
export declare class PipelineEngine {
    private activeProcesses;
    private callbacks;
    private runningPipelines;
    constructor(callbacks?: EngineCallbacks);
    execute(definition: PipelineDefinition, triggerType?: string, triggerInfo?: string): Promise<PipelineRun>;
    private executeStage;
    private executeTask;
    cancel(runId: string): void;
    private emitLog;
    dispose(): void;
}
//# sourceMappingURL=engine.d.ts.map