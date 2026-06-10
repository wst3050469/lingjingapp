import { getBrowserExecutor } from './browser-session.js';
export const browserClickTool = {
    name: 'browser_click',
    description: 'Click an element on the current page. Use CSS selectors or text-based selectors.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector or text to click (e.g., "button:has-text(\"Login\")", "text=Submit", "#myButton")',
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds',
                default: 10000,
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
            const result = await executor('click', params, context.signal);
            if (!result.success) {
                return { content: `Click failed: ${result.error}`, isError: true };
            }
            return { content: `Clicked: ${params.selector}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Click error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-click.js.map