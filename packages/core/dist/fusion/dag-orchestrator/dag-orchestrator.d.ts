import type { IEventBus } from '../event-bus/types.js';
import type { DAGDefinition, DAGResult, ExecutionLayer, ExecuteNodeCallback } from './types.js';
export declare class DAGOrchestrator {
    private eventBus;
    private executeNode;
    private healthy;
    constructor(executeNode: ExecuteNodeCallback, eventBus?: IEventBus);
    setEventBus(eventBus: IEventBus): void;
    validateDAG(dag: DAGDefinition): {
        valid: boolean;
        error?: string;
    };
    buildExecutionPlan(dag: DAGDefinition): ExecutionLayer[];
    private evaluateCondition;
    private executeNodeWithRetry;
    execute(dag: DAGDefinition, context: Record<string, unknown>): Promise<DAGResult>;
    healthCheck(): {
        healthy: boolean;
    };
}
//# sourceMappingURL=dag-orchestrator.d.ts.map