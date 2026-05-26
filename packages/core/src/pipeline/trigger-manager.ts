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
    private onTrigger?: (pipelineId: string, triggerType: 'push' | 'cron', info: string) => void;

    constructor(onTrigger?: (pipelineId: string, triggerType: 'push' | 'cron', info: string) => void) {
        this.onTrigger = onTrigger;
    }

    registerPushTrigger(
        definition: PipelineDefinition,
        onGitPush?: (cb: (event: GitEvent) => void) => () => void,
    ): void {
        const pushTriggers = definition.triggers.filter(t => t.type === 'push');
        if (pushTriggers.length === 0 || !onGitPush) return;

        const unregister = onGitPush((event: GitEvent) => {
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

    registerCronTrigger(definition: PipelineDefinition): void {
        const cronTriggers = definition.triggers.filter(t => t.type === 'cron');
        for (const trigger of cronTriggers) {
            if (!trigger.expression) continue;
            try {
                const interval = parseExpression(trigger.expression);
                const timer = setInterval(() => {
                    const next = interval.next();
                    this.onTrigger?.(definition.id, 'cron', `scheduled at ${next.toISOString()}`);
                }, 60000);
                this.cronTimers.set(`${definition.id}:${trigger.expression}`, timer);
            } catch (err) {
                console.error(`[Trigger] Invalid cron expression "${trigger.expression}":`, err);
            }
        }
    }

    registerAll(
        definition: PipelineDefinition,
        onGitPush?: (cb: (event: GitEvent) => void) => () => void,
    ): void {
        this.registerPushTrigger(definition, onGitPush);
        this.registerCronTrigger(definition);
    }

    dispose(): void {
        for (const timer of this.cronTimers.values()) clearInterval(timer);
        this.cronTimers.clear();
        for (const unregister of this.gitListeners) unregister();
        this.gitListeners = [];
    }
}
