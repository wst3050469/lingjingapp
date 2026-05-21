import type { IEventBus } from '../event-bus/types.js';
import type { ILLMAdapter } from '../adapters/types.js';
import type { TraceHarvesterConfig, ExecutionTrace, WorkflowPattern } from './types.js';
export declare class ExecutionTraceHarvester {
    private config;
    private eventBus;
    private llmAdapter;
    private traceBuffer;
    private pendingCalls;
    private sessionStartTimes;
    private enabled;
    constructor(config?: Partial<TraceHarvesterConfig>);
    initialize(eventBus: IEventBus, llmAdapter?: ILLMAdapter): void;
    collectTrace(sessionId: string): ExecutionTrace | null;
    analyzeAndGenerateSkill(sessionId: string): Promise<string | null>;
    extractWorkflowPattern(trace: ExecutionTrace): WorkflowPattern[];
    healthCheck(): {
        healthy: boolean;
    };
    private onToolCall;
    private onToolResult;
    private onMessageEnd;
    private cleanupSession;
    private generateSkillMd;
}
//# sourceMappingURL=execution-trace-harvester.d.ts.map