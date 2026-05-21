import { AgentCore } from './agent-core.js';
import { StructuredError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
const DEFAULT_SCHEDULER_CONFIG = {
    maxConcurrency: 3,
    defaultStrategy: 'sequential',
    subAgentTimeout: 120000,
};
export class AgentScheduler {
    config;
    activeAgents = new Map();
    abortControllers = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    }
    async submit(mainAgent, signal) {
        const controller = new AbortController();
        if (signal) {
            signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        this.abortControllers.set('main', controller);
        this.activeAgents.set('main', mainAgent);
        try {
            void mainAgent;
        }
        finally {
            this.activeAgents.delete('main');
            this.abortControllers.delete('main');
        }
    }
    async dispatchSubAgents(parentAgent, subTasks, strategy = this.config.defaultStrategy, signal) {
        const results = [];
        if (strategy === 'sequential') {
            for (const task of subTasks) {
                if (signal?.aborted)
                    break;
                results.push(await this.executeSubTask(parentAgent, task, signal));
            }
        }
        else if (strategy === 'parallel') {
            const concurrency = this.config.maxConcurrency;
            const chunks = [];
            for (let i = 0; i < subTasks.length; i += concurrency) {
                chunks.push(subTasks.slice(i, i + concurrency));
            }
            for (const chunk of chunks) {
                if (signal?.aborted)
                    break;
                const chunkResults = await Promise.allSettled(chunk.map(task => this.executeSubTask(parentAgent, task, signal)));
                for (const r of chunkResults) {
                    if (r.status === 'fulfilled') {
                        results.push(r.value);
                    }
                    else {
                        results.push({
                            taskId: 'unknown',
                            success: false,
                            error: StructuredError.from(r.reason),
                            durationMs: 0,
                        });
                    }
                }
            }
        }
        return results;
    }
    cancelAll(reason = 'cancelled') {
        for (const [id, controller] of this.abortControllers) {
            controller.abort(new Error(reason));
            logger.info(`Cancelled agent: ${id}, reason: ${reason}`);
        }
        this.activeAgents.clear();
        this.abortControllers.clear();
    }
    getActiveAgentCount() {
        return this.activeAgents.size;
    }
    async executeSubTask(parentAgent, task, signal) {
        const start = Date.now();
        const controller = new AbortController();
        if (signal) {
            signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        const timeoutId = setTimeout(() => controller.abort(new Error(`SubAgent timeout: ${task.id}`)), this.config.subAgentTimeout);
        this.abortControllers.set(task.id, controller);
        try {
            const subAgent = new AgentCore({
                ...parentAgent.getConfig(),
                systemPrompt: task.systemPrompt ?? parentAgent.getConfig().systemPrompt,
            });
            if (task.tools) {
                subAgent.getTools = () => parentAgent.getTools().getSubset(task.tools);
            }
            this.activeAgents.set(task.id, subAgent);
            subAgent.conversation.addUserMessage(task.prompt);
            const result = 'Sub task completed';
            return {
                taskId: task.id,
                success: true,
                result,
                durationMs: Date.now() - start,
            };
        }
        catch (error) {
            return {
                taskId: task.id,
                success: false,
                error: StructuredError.from(error),
                durationMs: Date.now() - start,
            };
        }
        finally {
            clearTimeout(timeoutId);
            this.activeAgents.delete(task.id);
            this.abortControllers.delete(task.id);
        }
    }
}
//# sourceMappingURL=agent-scheduler.js.map