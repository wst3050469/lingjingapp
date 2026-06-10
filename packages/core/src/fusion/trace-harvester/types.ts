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

export const DEFAULT_TRACE_HARVESTER_CONFIG: TraceHarvesterConfig = {
  enabled: true,
  minToolCalls: 3,
  minTraceDuration: 30000,
};
