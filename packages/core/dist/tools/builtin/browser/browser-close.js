import { getBrowserExecutor } from './browser-session.js';
export const browserCloseTool = {
    name: 'browser_close',
    description: 'Close the current tab or the entire browser session.',
    parameters: {
        type: 'object',
        properties: {
            closeTabOnly: {
                type: 'boolean',
                description: 'Close current tab but keep browser running',
                default: false,
            },
        },
        required: [],
    },
    async execute(params, context) {
        const executor = getBrowserExecutor();
        if (!executor) {
            return {
                content: 'Browser service not initialized.',
                isError: true,
            };
        }
        try {
            const result = await executor('close', params, context.signal);
            if (!result.success) {
                return { content: `Close failed: ${result.error}`, isError: true };
            }
            return { content: params.closeTabOnly ? 'Closed tab' : 'Closed browser' };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Close error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-close.js.map