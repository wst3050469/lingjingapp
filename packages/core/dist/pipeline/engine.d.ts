import type { PipelineDefinition, PipelineRun, PipelineLogEvent, PipelineStatus } from './types.js';
export interface EngineCallbacks {
    onLog?: (event: PipelineLogEvent) => void;
    onStatusChange?: (runId: string, status: PipelineStatus) => void;
    onDangerousCommand?: (cmd: string) => Promise<boolean>;
}
export declare class PipelineEngine {
    private activeProcesses;
    private callbacks;
    private runningPipelines;
    constructor(callbacks?: EngineCallbacks);
    execute(definition: PipelineDefinition, triggerType?: 'manual' | 'push' | 'cron', triggerInfo?: string): Promise<PipelineRun>;
    private executeStage;
    private executeTask;
    cancel(runId: string): void;
    private emitLog;
    dispose(): void;
}
//# sourceMappingURL=engine.d.ts.map