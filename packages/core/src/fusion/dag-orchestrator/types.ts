export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
}

export interface BranchCondition {
  expression: string;
  expectedValue: unknown;
}

export interface TaskDefinition {
  name: string;
  prompt: string;
  tools?: string[];
  model?: string;
}

export interface DAGNode {
  taskId: string;
  taskDef: TaskDefinition;
  dependencies: string[];
  condition?: BranchCondition;
}

export interface DAGEdge {
  from: string;
  to: string;
  condition?: BranchCondition;
}

export interface DAGDefinition {
  id: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  maxConcurrency?: number;
  retryPolicy?: RetryPolicy;
}

export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'skipped';
  output: string;
  duration: number;
}

export interface DAGResult {
  dagId: string;
  nodeResults: Map<string, TaskResult>;
  failedNodes: string[];
  totalTime: number;
  status: 'completed' | 'partial' | 'failed' | 'cancelled';
}

export interface ExecutionLayer {
  nodes: DAGNode[];
  index: number;
}

export type ExecuteNodeCallback = (
  taskDef: TaskDefinition,
  context: Record<string, unknown>,
) => Promise<string>;

export interface IDAGOrchestrator {
  validateDAG(dag: DAGDefinition): { valid: boolean; error?: string };
  buildExecutionPlan(dag: DAGDefinition): ExecutionLayer[];
  execute(dag: DAGDefinition, context: Record<string, unknown>): Promise<DAGResult>;
  healthCheck(): { healthy: boolean };
}
