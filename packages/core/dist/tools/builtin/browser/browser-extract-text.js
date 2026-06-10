import { getBrowserExecutor } from './browser-session.js';
export const browserExtractTextTool = {
    name: 'browser_extract_text',
    description: 'Extract text content from the current page or a specific element.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector to extract from (optional, extracts full page if omitted)',
            },
            maxLength: {
                type: 'number',
                description: 'Maximum characters to return',
                default: 10000,
            },
        },
        required: [],
    },
    async execute(params, context) {
        const executor = getBrowserExecutor();
        if (!executor) {
            return {
                content: 'Browser service not initialized. Use /browser command first.',
                isError: true,
            };
        }
        try {
            const result = await executor('extractText', params, context.signal);
            if (!result.success) {
                return { content: `Extract text failed: ${result.error}`, isError: true };
            }
            const data = result.data;
            return { content: data.text || '(no text found)' };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Extract text error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-extract-text.js.map