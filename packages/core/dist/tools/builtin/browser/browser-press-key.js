import { getBrowserExecutor } from './browser-session.js';
export const browserPressKeyTool = {
    name: 'browser_press_key',
    description: 'Press a keyboard key on the current page.',
    parameters: {
        type: 'object',
        properties: {
            key: {
                type: 'string',
                description: 'Key to press (e.g., "Enter", "Escape", "Tab", "ArrowDown", "Control+A")',
            },
        },
        required: ['key'],
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
            const result = await executor('pressKey', params, context.signal);
            if (!result.success) {
                return { content: `Press key failed: ${result.error}`, isError: true };
            }
            return { content: `Pressed key: ${params.key}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Press key error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-press-key.js.map