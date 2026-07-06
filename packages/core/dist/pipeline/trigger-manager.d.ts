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
    /**
     * Extended trigger management API.
     * These methods provide full CRUD on triggers beyond the basic push/cron registration.
     */
    registerTrigger(type: string, config: import('./types.js').TriggerConfig): Promise<string>;
    updateTrigger(triggerId: string, config: Partial<import('./types.js').TriggerConfig>): Promise<void>;
    unregisterTrigger(triggerId: string): Promise<void>;
    enableTrigger(triggerId: string): Promise<void>;
    disableTrigger(triggerId: string): Promise<void>;
    getTriggerStatus(triggerId: string): import('./types.js').TriggerStatus | null;
    listTriggers(): Array<{ id: string; type: string; status: import('./types.js').TriggerStatus }>;
    getTriggerConfig(triggerId: string): import('./types.js').TriggerConfig | null;
    dispose(): void;
}
//# sourceMappingURL=trigger-manager.d.ts.map