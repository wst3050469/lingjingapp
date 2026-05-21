import { getBrowserExecutor } from './browser-session.js';
export const browserWaitTool = {
    name: 'browser_wait',
    description: 'Wait for a specified duration, selector, or page load.',
    parameters: {
        type: 'object',
        properties: {
            type: {
                type: 'string',
                enum: ['timeout', 'selector', 'load'],
                description: 'Type of wait',
                default: 'timeout',
            },
            duration: {
                type: 'number',
                description: 'Milliseconds to wait (for timeout type)',
                default: 1000,
            },
            selector: {
                type: 'string',
                description: 'Selector to wait for (for selector type)',
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
            const result = await executor('wait', params, context.signal);
            if (!result.success) {
                return { content: `Wait failed: ${result.error}`, isError: true };
            }
            return { content: `Waited for ${params.type || 'timeout'}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Wait error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-wait.js.map