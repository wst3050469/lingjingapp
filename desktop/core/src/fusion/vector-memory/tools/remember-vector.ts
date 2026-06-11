import type { Tool, ToolResult, ToolContext, JSONSchema } from '../../adapters/types.js';
import type { IVectorMemoryStore } from '../types.js';

const parameters: JSONSchema = {
  type: 'object',
  properties: {
    content: { type: 'string', description: 'Content to remember' },
    metadata: { type: 'object', description: 'Optional metadata' },
  },
  required: ['content'],
};

export function createRememberVectorTool(store: IVectorMemoryStore): Tool {
  return {
    name: 'remember_vector',
    description: 'Store content in vector memory for semantic retrieval',
    parameters,
    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
      try {
        const content = params.content as string;
        const metadata = (params.metadata as Record<string, unknown>) ?? {};
        const id = await store.store(content, metadata);
        return { content: `Remembered with id: ${id}` };
      } catch (err) {
        return { content: `Failed to remember: ${(err as Error).message}`, isError: true };
      }
    },
  };
}
