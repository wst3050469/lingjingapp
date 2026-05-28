"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerManager = void 0;
const cron_parser_1 = __importDefault(require("cron-parser"));
const { parseExpression } = cron_parser_1.default;
class TriggerManager {
    cronTimers = new Map();
    gitListeners = [];
    onTrigger;
    constructor(onTrigger) {
        this.onTrigger = onTrigger;
    }
    registerPushTrigger(definition, onGitPush) {
        const pushTriggers = definition.triggers.filter(t => t.type === 'push');
        if (pushTriggers.length === 0 || !onGitPush)
            return;
        const unregister = onGitPush((event) => {
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
    registerAll(definition, onGitPush) {
        this.registerPushTrigger(definition, onGitPush);
        this.registerCronTrigger(definition);
    }
    dispose() {
        for (const timer of this.cronTimers.values())
            clearInterval(timer);
        this.cronTimers.clear();
        for (const unregister of this.gitListeners)
            unregister();
        this.gitListeners = [];
    }
}
exports.TriggerManager = TriggerManager;
//# sourceMappingURL=trigger-manager.js.map