import { getBrowserExecutor } from './browser-session.js';
export const browserTypeTool = {
    name: 'browser_type',
    description: 'Type text into an input field on the current page.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector for the input element',
            },
            text: {
                type: 'string',
                description: 'Text to type',
            },
            clearFirst: {
                type: 'boolean',
                description: 'Clear existing text before typing',
                default: true,
            },
            pressEnter: {
                type: 'boolean',
                description: 'Press Enter after typing',
                default: false,
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds',
                default: 10000,
            },
        },
        required: ['selector', 'text'],
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
            const result = await executor('type', params, context.signal);
            if (!result.success) {
                return { content: `Type failed: ${result.error}`, isError: true };
            }
            return { content: `Typed "${params.text}" into ${params.selector}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Type error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-type.js.map