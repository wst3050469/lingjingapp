import { getBrowserExecutor } from './browser-session.js';
export const browserScreenshotTool = {
    name: 'browser_screenshot',
    description: 'Capture a screenshot of the current page. Useful for verifying page state.',
    parameters: {
        type: 'object',
        properties: {
            fullPage: {
                type: 'boolean',
                description: 'Capture full scrollable page',
                default: false,
            },
            format: {
                type: 'string',
                enum: ['png', 'jpeg'],
                description: 'Image format',
                default: 'png',
            },
            quality: {
                type: 'number',
                description: 'JPEG quality 0-100 (only for jpeg)',
                default: 80,
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
            const result = await executor('screenshot', params, context.signal);
            if (!result.success) {
                return { content: `Screenshot failed: ${result.error}`, isError: true };
            }
            return {
                content: 'Screenshot captured successfully. Image sent to UI.',
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Screenshot error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-screenshot.js.map