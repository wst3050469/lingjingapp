import type { PipelineDefinition } from './types.js';
export interface GitEvent {
    branch: string;
    commitSha: string;
}
export declare class TriggerManager {
    private cronTimers;
    private gitListeners;
    private activePipelines;
    private enabledPipelines;
    private onTrigger?;
    private onStatusChange?;
    constructor(options?: {
        onTrigger?: (pipelineId: string, triggerType: 'push' | 'cron', info: string) => void;
        onStatusChange?: (pipelineId: string, status: 'enabled' | 'disabled' | 'removed') => void;
    });
    registerAll(definition: PipelineDefinition, onGitPush?: (cb: (event: GitEvent) => void) => () => void): void;
    addPipeline(definition: PipelineDefinition, onGitPush?: (cb: (event: GitEvent) => void) => () => void): void;
    private registerPushTrigger;
    private registerCronTrigger;
    removePipeline(pipelineId: string): void;
    setPipelineEnabled(pipelineId: string, enabled: boolean): void;
    getPipelineConfig(pipelineId: string): PipelineDefinition | undefined;
    listPipelines(): Array<{
        id: string;
        enabled: boolean;
    }>;
    dispose(): void;
}
//# sourceMappingURL=trigger-manager.d.ts.map