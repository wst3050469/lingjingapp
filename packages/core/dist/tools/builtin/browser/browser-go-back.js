import { getBrowserExecutor } from './browser-session.js';
export const browserGoBackTool = {
    name: 'browser_go_back',
    description: 'Go back in browser history.',
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
            const result = await executor('goBack', {}, context.signal);
            if (!result.success) {
                return { content: `Go back failed: ${result.error}`, isError: true };
            }
            const data = result.data;
            return { content: `Went back to ${data.url}\nTitle: ${data.title}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Go back error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-go-back.js.map