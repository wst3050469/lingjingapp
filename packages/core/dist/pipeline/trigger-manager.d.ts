import type { PipelineDefinition, WatchConfig } from './types.js';
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
        onTrigger?: (pipelineId: string, triggerType: 'push' | 'cron' | 'watch', info: string) => void;
        onStatusChange?: (pipelineId: string, status: 'enabled' | 'disabled' | 'removed') => void;
    });
    registerAll(definition: PipelineDefinition, onGitPush?: (cb: (event: GitEvent) => void) => () => void): void;
    addPipeline(definition: PipelineDefinition, onGitPush?: (cb: (event: GitEvent) => void) => () => void): void;
    private registerPushTrigger;
    private registerCronTrigger;
    /**
     * 注册文件变更（watch）触发器。
     * @param onWatchFiles - 调用者提供的文件监听函数，接收 WatchConfig 和回调，
     *                       返回取消监听的函数。由 electron 层实现具体的 fs.watch。
     */
    registerWatchTrigger(definition: PipelineDefinition, onWatchFiles: (config: WatchConfig, cb: (event: {
        filePath: string;
        type: 'change' | 'add' | 'unlink';
    }) => void) => () => void): void;
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