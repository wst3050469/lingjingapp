import { getBrowserExecutor } from './browser-session.js';
export const browserExtractTableTool = {
    name: 'browser_extract_table',
    description: 'Extract table data from the current page and convert to markdown format.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector for the table element',
            },
        },
        required: ['selector'],
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
            const result = await executor('extractTable', params, context.signal);
            if (!result.success) {
                return { content: `Extract table failed: ${result.error}`, isError: true };
            }
            const data = result.data;
            return { content: data.markdown || '(no table found)' };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Extract table error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-extract-table.js.map