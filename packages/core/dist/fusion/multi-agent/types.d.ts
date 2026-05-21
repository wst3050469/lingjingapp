export interface MultiAgentConfig {
    enabled: boolean;
    maxConcurrency: number;
    taskTimeout: number;
    degradeToSequential: boolean;
}
export interface ParallelTask {
    taskId: string;
    prompt: string;
    tools?: string[];
    model?: string;
}
export interface TaskExecutionResult {
    taskId: string;
    status: 'completed' | 'failed' | 'timeout';
    output: string;
    duration: number;
    error?: string;
}
export interface ParallelResult {
    results: TaskExecutionResult[];
    failedTasks: string[];
    timedOutTasks: string[];
    totalTime: number;
}
export type ExecuteSingleTaskCallback = (task: ParallelTask, context: Record<string, unknown>, signal: AbortSignal) => Promise<string>;
export interface IMultiAgentExecutor {
    execute(tasks: ParallelTask[], context?: Record<string, unknown>): Promise<ParallelResult>;
    healthCheck(): {
        healthy: boolean;
    };
}
export declare const DEFAULT_MULTI_AGENT_CONFIG: MultiAgentConfig;
//# sourceMappingURL=types.d.ts.map