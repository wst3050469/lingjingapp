import { getBrowserExecutor } from './browser-session.js';
export const browserGetPageInfoTool = {
    name: 'browser_get_page_info',
    description: 'Get current page URL and title.',
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
            const result = await executor('getPageInfo', {}, context.signal);
            if (!result.success) {
                return { content: `Get page info failed: ${result.error}`, isError: true };
            }
            const data = result.data;
            return { content: `URL: ${data.url}\nTitle: ${data.title}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Get page info error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-get-page-info.js.map