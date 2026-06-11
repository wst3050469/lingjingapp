import type { Tool, ToolResult, ToolContext, JSONSchema } from '../../adapters/types.js';
import type { MultiAgentExecutor } from '../multi-agent-executor.js';
import type { ParallelTask } from '../types.js';
import { logger } from '../../../utils/logger.js';

const PARAMETERS: JSONSchema = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Unique task identifier' },
          prompt: { type: 'string', description: 'Task prompt to execute' },
          tools: {
            type: 'array',
            items: { type: 'string' },
            description: 'Allowed tools for this task',
          },
          model: { type: 'string', description: 'Model override for this task' },
        },
        required: ['taskId', 'prompt'],
      },
      description: 'Array of tasks to execute in parallel',
    },
    maxConcurrency: {
      type: 'number',
      description: 'Maximum number of concurrent tasks',
    },
  },
  required: ['tasks'],
};

export function createParallelExecuteTool(executor: MultiAgentExecutor): Tool {
  return {
    name: 'parallel_execute',
    description: 'Execute multiple agent tasks in parallel with configurable concurrency',
    parameters: PARAMETERS,
    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
      try {
        const rawTasks = params.tasks as Array<Record<string, unknown>>;
        if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
          return { content: 'No tasks provided', isError: true };
        }

        const tasks: ParallelTask[] = rawTasks.map((t) => ({
          taskId: t.taskId as string,
          prompt: t.prompt as string,
          tools: t.tools as string[] | undefined,
          model: t.model as string | undefined,
        }));

        const duplicateIds = tasks
          .map((t) => t.taskId)
          .filter((id, i, arr) => arr.indexOf(id) !== i);
        if (duplicateIds.length > 0) {
          return {
            content: `Duplicate task IDs: ${duplicateIds.join(', ')}`,
            isError: true,
          };
        }

        const context: Record<string, unknown> = {};
        if (params.maxConcurrency != null) {
          context.maxConcurrency = params.maxConcurrency;
        }

        const result = await executor.execute(tasks, context);

        const summary = {
          total: result.results.length,
          completed: result.results.filter((r) => r.status === 'completed').length,
          failed: result.failedTasks.length,
          timedOut: result.timedOutTasks.length,
          totalTime: result.totalTime,
          results: result.results.map((r) => ({
            taskId: r.taskId,
            status: r.status,
            output: r.output,
            duration: r.duration,
            error: r.error,
          })),
        };

        logger.info(
          `[ParallelExecuteTool] ${summary.completed}/${summary.total} completed in ${summary.totalTime}ms`,
        );

        return { content: JSON.stringify(summary, null, 2) };
      } catch (err) {
        return {
          content: `Parallel execution failed: ${(err as Error).message}`,
          isError: true,
        };
      }
    },
  };
}
