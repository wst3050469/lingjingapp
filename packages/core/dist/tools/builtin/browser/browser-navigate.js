import { getBrowserExecutor } from './browser-session.js';
export const browserNavigateTool = {
    name: 'browser_navigate',
    description: 'Navigate to a URL in the browser. Always call this before interacting with a webpage.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The full URL to navigate to (include https://)',
            },
            waitUntil: {
                type: 'string',
                enum: ['load', 'domcontentloaded', 'networkidle'],
                description: 'When to consider navigation complete',
                default: 'load',
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds',
                default: 30000,
            },
        },
        required: ['url'],
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
            const result = await executor('navigate', params, context.signal);
            if (!result.success) {
                return { content: `Navigation failed: ${result.error}`, isError: true };
            }
            const data = result.data;
            return {
                content: `Navigated to ${data.url}\nTitle: ${data.title}${data.status ? `\nStatus: ${data.status}` : ''}`,
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Navigation error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-navigate.js.map