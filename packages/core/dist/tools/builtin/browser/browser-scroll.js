import { getBrowserExecutor } from './browser-session.js';
export const browserScrollTool = {
    name: 'browser_scroll',
    description: 'Scroll the current page in a specified direction.',
    parameters: {
        type: 'object',
        properties: {
            direction: {
                type: 'string',
                enum: ['up', 'down', 'top', 'bottom'],
                description: 'Direction to scroll',
            },
            amount: {
                type: 'number',
                description: 'Pixels to scroll (for up/down)',
                default: 500,
            },
        },
        required: ['direction'],
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
            const result = await executor('scroll', params, context.signal);
            if (!result.success) {
                return { content: `Scroll failed: ${result.error}`, isError: true };
            }
            return { content: `Scrolled ${params.direction}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Scroll error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-scroll.js.map