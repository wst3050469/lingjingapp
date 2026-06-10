import { AgentCore } from './agent-core.js';
import { StructuredError } from '../errors/index.js';
export type ExecutionStrategy = 'parallel' | 'sequential' | 'dag';
export interface SubTaskDefinition {
    id: string;
    prompt: string;
    systemPrompt?: string;
    tools?: string[];
}
export interface SubAgentResult {
    taskId: string;
    success: boolean;
    result?: string;
    error?: StructuredError;
    durationMs: number;
}
export interface SchedulerConfig {
    maxConcurrency: number;
    defaultStrategy: ExecutionStrategy;
    subAgentTimeout: number;
}
export declare class AgentScheduler {
    private config;
    private activeAgents;
    private abortControllers;
    constructor(config?: Partial<SchedulerConfig>);
    submit(mainAgent: AgentCore, signal?: AbortSignal): Promise<void>;
    dispatchSubAgents(parentAgent: AgentCore, subTasks: SubTaskDefinition[], strategy?: ExecutionStrategy, signal?: AbortSignal): Promise<SubAgentResult[]>;
    cancelAll(reason?: string): void;
    getActiveAgentCount(): number;
    private executeSubTask;
}
//# sourceMappingURL=agent-scheduler.d.ts.map