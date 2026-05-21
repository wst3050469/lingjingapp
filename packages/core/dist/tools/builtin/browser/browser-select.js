import { getBrowserExecutor } from './browser-session.js';
export const browserSelectTool = {
    name: 'browser_select',
    description: 'Select an option from a dropdown menu on the current page.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector for the select element',
            },
            value: {
                type: 'string',
                description: 'Value to select',
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds',
                default: 10000,
            },
        },
        required: ['selector', 'value'],
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
            const result = await executor('select', params, context.signal);
            if (!result.success) {
                return { content: `Select failed: ${result.error}`, isError: true };
            }
            return { content: `Selected "${params.value}" in ${params.selector}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Select error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-select.js.map