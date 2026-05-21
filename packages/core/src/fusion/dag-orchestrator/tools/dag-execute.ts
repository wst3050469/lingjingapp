import type { Tool, ToolResult, ToolContext, JSONSchema } from '../../adapters/types.js';
import type { DAGOrchestrator } from '../dag-orchestrator.js';
import type { DAGDefinition } from '../types.js';
import { logger } from '../../../utils/logger.js';

const PARAMETERS: JSONSchema = {
  type: 'object',
  properties: {
    dag: {
      type: 'object',
      description: 'DAG definition with nodes, edges, and optional policies',
      properties: {
        id: { type: 'string', description: 'Unique DAG identifier' },
        nodes: {
          type: 'array',
          description: 'Array of DAG nodes with task definitions and dependencies',
          items: { type: 'object' },
        },
        edges: {
          type: 'array',
          description: 'Array of DAG edges defining execution flow',
          items: { type: 'object' },
        },
        maxConcurrency: {
          type: 'number',
          description: 'Maximum concurrent node executions per layer',
        },
        retryPolicy: {
          type: 'object',
          description: 'Retry policy for failed nodes',
          properties: {
            maxRetries: { type: 'number' },
            retryDelay: { type: 'number' },
          },
        },
      },
      required: ['id', 'nodes', 'edges'],
    },
    context: {
      type: 'object',
      description: 'Shared context object available to all nodes',
    },
  },
  required: ['dag'],
};

export function createDagExecuteTool(orchestrator: DAGOrchestrator): Tool {
  return {
    name: 'dag_execute',
    description: 'Execute a DAG (directed acyclic graph) workflow with dependency-ordered parallel execution',
    parameters: PARAMETERS,
    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
      try {
        const dag = params.dag as DAGDefinition;
        if (!dag || !dag.id) {
          return { content: 'Invalid DAG: missing id', isError: true };
        }

        const validation = orchestrator.validateDAG(dag);
        if (!validation.valid) {
          return {
            content: `DAG validation failed: ${validation.error}`,
            isError: true,
          };
        }

        const context = (params.context as Record<string, unknown>) ?? {};
        const result = await orchestrator.execute(dag, context);

        const nodeSummaries: Record<string, unknown> = {};
        for (const [taskId, taskResult] of result.nodeResults) {
          nodeSummaries[taskId] = {
            status: taskResult.status,
            output: taskResult.output,
            duration: taskResult.duration,
          };
        }

        const summary = {
          dagId: result.dagId,
          status: result.status,
          failedNodes: result.failedNodes,
          totalTime: result.totalTime,
          nodes: nodeSummaries,
        };

        logger.info(
          `[DagExecuteTool] DAG ${result.dagId} ${result.status} in ${result.totalTime}ms`,
        );

        return { content: JSON.stringify(summary, null, 2) };
      } catch (err) {
        return {
          content: `DAG execution failed: ${(err as Error).message}`,
          isError: true,
        };
      }
    },
  };
}
