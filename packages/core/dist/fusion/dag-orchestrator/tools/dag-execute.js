import { logger } from '../../../utils/logger.js';
const PARAMETERS = {
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
export function createDagExecuteTool(orchestrator) {
    return {
        name: 'dag_execute',
        description: 'Execute a DAG (directed acyclic graph) workflow with dependency-ordered parallel execution',
        parameters: PARAMETERS,
        async execute(params, _context) {
            try {
                const dag = params.dag;
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
                const context = params.context ?? {};
                const result = await orchestrator.execute(dag, context);
                const nodeSummaries = {};
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
                logger.info(`[DagExecuteTool] DAG ${result.dagId} ${result.status} in ${result.totalTime}ms`);
                return { content: JSON.stringify(summary, null, 2) };
            }
            catch (err) {
                return {
                    content: `DAG execution failed: ${err.message}`,
                    isError: true,
                };
            }
        },
    };
}
//# sourceMappingURL=dag-execute.js.map