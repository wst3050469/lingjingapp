export interface TraceHarvesterConfig {
    enabled: boolean;
    minToolCalls: number;
    minTraceDuration: number;
}
export interface ToolCallStep {
    toolName: string;
    parameters: Record<string, unknown>;
    result: string;
    duration: number;
    timestamp: number;
}
export interface ExecutionTrace {
    sessionId: string;
    toolCallSequence: ToolCallStep[];
    startTime: number;
    endTime: number;
    totalSteps: number;
}
export interface WorkflowPattern {
    name: string;
    steps: string[];
    frequency: number;
}
export declare const DEFAULT_TRACE_HARVESTER_CONFIG: TraceHarvesterConfig;
//# sourceMappingURL=types.d.ts.map