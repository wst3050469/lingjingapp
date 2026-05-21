import { getBrowserExecutor } from './browser-session.js';
export const browserGoForwardTool = {
    name: 'browser_go_forward',
    description: 'Go forward in browser history.',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    async execute(_params, context) {
        const executor = getBrowserExecutor();
        if (!executor) {
            return {
                content: 'Browser service not initialized. Use /browser command first.',
                isError: true,
            };
        }
        try {
            const result = await executor('goForward', {}, context.signal);
            if (!result.success) {
                return { content: `Go forward failed: ${result.error}`, isError: true };
            }
            const data = result.data;
            return { content: `Went forward to ${data.url}\nTitle: ${data.title}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Go forward error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-go-forward.js.map