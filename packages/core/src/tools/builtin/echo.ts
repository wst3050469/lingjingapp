/**
 * Built-in Echo Tool
 *
 * Simple echo tool that returns the input as output.
 * Serves as a baseline tool implementation template.
 */
import type { Tool, ToolResult } from '../types.js';

export const echoTool: Tool = {
  name: 'echo',
  description: 'Echoes back the provided input string.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back',
      },
    },
    required: ['message'],
  },
  async execute(params: Record<string, unknown>, context: any): Promise<ToolResult> {
    const message = String(params.message ?? '');
    return {
      content: message,
    };
  },
};
