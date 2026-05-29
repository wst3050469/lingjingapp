import cronParser from 'cron-parser';
import type { PipelineDefinition } from './types.js';

const { parseExpression } = cronParser;

export interface GitEvent {
    branch: string;
    commitSha: string;
}

export class TriggerManager {
    private cronTimers = new Map<string, ReturnType<typeof setInterval>>();
    private gitListeners: Array<() => void> = [];
    private activePipelines = new Map<string, PipelineDefinition>();
    private enabledPipelines = new Set<string>();
    private onTrigger?: (pipelineId: string, triggerType: 'push' | 'cron', info: string) => void;
    private onStatusChange?: (pipelineId: string, status: 'enabled' | 'disabled' | 'removed') => void;

    constructor(options?: {
        onTrigger?: (pipelineId: string, triggerType: 'push' | 'cron', info: string) => void;
        onStatusChange?: (pipelineId: string, status: 'enabled' | 'disabled' | 'removed') => void;
    }) {
        this.onTrigger = options?.onTrigger;
        this.onStatusChange = options?.onStatusChange;
    }

    registerAll(
        definition: PipelineDefinition,
        onGitPush?: (cb: (event: GitEvent) => void) => () => void,
    ): void {
        this.addPipeline(definition, onGitPush);
    }

    addPipeline(definition: PipelineDefinition, onGitPush?: (cb: (event: GitEvent) => void) => () => void): void {
        this.activePipelines.set(definition.id, definition);
        this.enabledPipelines.add(definition.id);
        
        if (onGitPush) {
            this.registerPushTrigger(definition, onGitPush);
        }
        this.registerCronTrigger(definition);
    }

    private registerPushTrigger(
        definition: PipelineDefinition,
        onGitPush: (cb: (event: GitEvent) => void) => () => void,
    ): void {
        const pushTriggers = definition.triggers.filter(t => t.type === 'push');
        if (pushTriggers.length === 0) return;

        const unregister = onGitPush((event: GitEvent) => {
            if (!this.enabledPipelines.has(definition.id)) return;
            
            for (const trigger of pushTriggers) {
                if (
                    !trigger.branches ||
                    trigger.branches.length === 0 ||
                    trigger.branches.includes(event.branch)
                ) {
                    this.onTrigger?.(definition.id, 'push', `branch=${event.branch} sha=${event.commitSha}`);
                }
            }
        });
        this.gitListeners.push(unregister);
    }

    private registerCronTrigger(definition: PipelineDefinition): void {
        const cronTriggers = definition.triggers.filter(t => t.type === 'cron');
        for (const trigger of cronTriggers) {
            if (!trigger.expression) continue;
            try {
                const interval = parseExpression(trigger.expression);
                const timer = setInterval(() => {
                    if (!this.enabledPipelines.has(definition.id)) return;
                    const next = interval.next();
                    this.onTrigger?.(definition.id, 'cron', `scheduled at ${next.toISOString()}`);
                }, 60000);
                this.cronTimers.set(`${definition.id}:${trigger.expression}`, timer);
            } catch (err) {
                console.error(`[Trigger] Invalid cron expression "${trigger.expression}":`, err);
            }
        }
    }

    removePipeline(pipelineId: string): void {
        this.activePipelines.delete(pipelineId);
        this.onStatusChange?.(pipelineId, 'removed');
        
        for (const [key, timer] of this.cronTimers.entries()) {
            if (key.startsWith(`${pipelineId}:`)) {
                clearInterval(timer as any);
                this.cronTimers.delete(key);
            }
        }
        
        this.enabledPipelines.delete(pipelineId);
    }

    setPipelineEnabled(pipelineId: string, enabled: boolean): void {
        const pipeline = this.activePipelines.get(pipelineId);
        if (!pipeline) return;

        if (enabled) {
            this.enabledPipelines.add(pipelineId);
            this.onStatusChange?.(pipelineId, 'enabled');
        } else {
            this.enabledPipelines.delete(pipelineId);
            this.onStatusChange?.(pipelineId, 'disabled');
        }
    }

    getPipelineConfig(pipelineId: string): PipelineDefinition | undefined {
        return this.activePipelines.get(pipelineId);
    }

    listPipelines(): Array<{ id: string; enabled: boolean }> {
        return Array.from(this.activePipelines.entries()).map(([id, _]) => ({
            id,
            enabled: this.enabledPipelines.has(id)
        }));
    }

    dispose(): void {
        for (const timer of this.cronTimers.values()) clearInterval(timer as any);
        this.cronTimers.clear();
        for (const unregister of this.gitListeners) unregister();
        this.gitListeners = [];
        this.activePipelines.clear();
        this.enabledPipelines.clear();
    }
}
