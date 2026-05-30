import type { PipelineDefinition } from './types.js';
export interface GitEvent {
    branch: string;
    commitSha: string;
}
export declare class TriggerManager {
    private cronTimers;
    private gitListeners;
    private onTrigger?;
    constructor(onTrigger?: (pipelineId: string, triggerType: 'push' | 'cron', info: string) => void);
    registerPushTrigger(definition: PipelineDefinition, onGitPush?: (cb: (event: GitEvent) => void) => () => void): void;
    registerCronTrigger(definition: PipelineDefinition): void;
    registerAll(definition: PipelineDefinition, onGitPush?: (cb: (event: GitEvent) => void) => () => void): void;
    dispose(): void;
}
//# sourceMappingURL=trigger-manager.d.ts.map