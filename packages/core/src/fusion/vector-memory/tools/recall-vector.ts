import type { Tool, ToolResult, ToolContext, JSONSchema } from '../../adapters/types.js';
import type { IVectorMemoryStore } from '../types.js';

const parameters: JSONSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Search query' },
    topK: { type: 'number', description: 'Number of results to return' },
  },
  required: ['query'],
};

export function createRecallVectorTool(store: IVectorMemoryStore): Tool {
  return {
    name: 'recall_vector',
    description: 'Search vector memory for semantically similar content',
    parameters,
    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
      try {
        const query = params.query as string;
        const topK = (params.topK as number) ?? 5;
        const results = await store.search(query, topK);

        if (results.length === 0) {
          return { content: 'No results found' };
        }

        const formatted = results
          .map((r, i) => `${i + 1}. [${r.score.toFixed(3)}] ${r.content}`)
          .join('\n');

        return { content: formatted };
      } catch (err) {
        return { content: `Failed to recall: ${(err as Error).message}`, isError: true };
      }
    },
  };
}
