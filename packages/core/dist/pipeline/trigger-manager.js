import cronParser from 'cron-parser';
const { parseExpression } = cronParser;
export class TriggerManager {
    cronTimers = new Map();
    gitListeners = [];
    activePipelines = new Map();
    enabledPipelines = new Set();
    onTrigger;
    onStatusChange;
    constructor(options) {
        this.onTrigger = options?.onTrigger;
        this.onStatusChange = options?.onStatusChange;
    }
    registerAll(definition, onGitPush) {
        this.addPipeline(definition, onGitPush);
    }
    addPipeline(definition, onGitPush) {
        this.activePipelines.set(definition.id, definition);
        this.enabledPipelines.add(definition.id);
        if (onGitPush) {
            this.registerPushTrigger(definition, onGitPush);
        }
        this.registerCronTrigger(definition);
    }
    registerPushTrigger(definition, onGitPush) {
        const pushTriggers = definition.triggers.filter(t => t.type === 'push');
        if (pushTriggers.length === 0)
            return;
        const unregister = onGitPush((event) => {
            if (!this.enabledPipelines.has(definition.id))
                return;
            for (const trigger of pushTriggers) {
                if (!trigger.branches ||
                    trigger.branches.length === 0 ||
                    trigger.branches.includes(event.branch)) {
                    this.onTrigger?.(definition.id, 'push', `branch=${event.branch} sha=${event.commitSha}`);
                }
            }
        });
        this.gitListeners.push(unregister);
    }
    registerCronTrigger(definition) {
        const cronTriggers = definition.triggers.filter(t => t.type === 'cron');
        for (const trigger of cronTriggers) {
            if (!trigger.expression)
                continue;
            try {
                const interval = parseExpression(trigger.expression);
                const timer = setInterval(() => {
                    if (!this.enabledPipelines.has(definition.id))
                        return;
                    const next = interval.next();
                    this.onTrigger?.(definition.id, 'cron', `scheduled at ${next.toISOString()}`);
                }, 60000);
                this.cronTimers.set(`${definition.id}:${trigger.expression}`, timer);
            }
            catch (err) {
                console.error(`[Trigger] Invalid cron expression "${trigger.expression}":`, err);
            }
        }
    }
    removePipeline(pipelineId) {
        this.activePipelines.delete(pipelineId);
        this.onStatusChange?.(pipelineId, 'removed');
        for (const [key, timer] of this.cronTimers.entries()) {
            if (key.startsWith(`${pipelineId}:`)) {
                clearInterval(timer);
                this.cronTimers.delete(key);
            }
        }
        this.enabledPipelines.delete(pipelineId);
    }
    setPipelineEnabled(pipelineId, enabled) {
        const pipeline = this.activePipelines.get(pipelineId);
        if (!pipeline)
            return;
        if (enabled) {
            this.enabledPipelines.add(pipelineId);
            this.onStatusChange?.(pipelineId, 'enabled');
        }
        else {
            this.enabledPipelines.delete(pipelineId);
            this.onStatusChange?.(pipelineId, 'disabled');
        }
    }
    getPipelineConfig(pipelineId) {
        return this.activePipelines.get(pipelineId);
    }
    listPipelines() {
        return Array.from(this.activePipelines.entries()).map(([id, _]) => ({
            id,
            enabled: this.enabledPipelines.has(id)
        }));
    }
    dispose() {
        for (const timer of this.cronTimers.values())
            clearInterval(timer);
        this.cronTimers.clear();
        for (const unregister of this.gitListeners)
            unregister();
        this.gitListeners = [];
        this.activePipelines.clear();
        this.enabledPipelines.clear();
    }
}
//# sourceMappingURL=trigger-manager.js.map