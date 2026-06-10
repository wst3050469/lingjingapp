import type { IEventBus } from '../event-bus/types.js';
import type { MultiAgentConfig, ParallelTask, ParallelResult, ExecuteSingleTaskCallback } from './types.js';
export declare class MultiAgentExecutor {
    private config;
    private eventBus;
    private executeSingleTask;
    private healthy;
    constructor(executeSingleTask: ExecuteSingleTaskCallback, config?: Partial<MultiAgentConfig>, eventBus?: IEventBus);
    setEventBus(eventBus: IEventBus): void;
    private executeTask;
    execute(tasks: ParallelTask[], context?: Record<string, unknown>): Promise<ParallelResult>;
    healthCheck(): {
        healthy: boolean;
    };
}
//# sourceMappingURL=multi-agent-executor.d.ts.map