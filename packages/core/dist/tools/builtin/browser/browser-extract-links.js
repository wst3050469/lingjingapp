import { getBrowserExecutor } from './browser-session.js';
export const browserExtractLinksTool = {
    name: 'browser_extract_links',
    description: 'Extract all links from the current page or a specific scope.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'CSS selector scope (optional)',
            },
            maxLinks: {
                type: 'number',
                description: 'Maximum number of links to return',
                default: 50,
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
            const result = await executor('extractLinks', params, context.signal);
            if (!result.success) {
                return { content: `Extract links failed: ${result.error}`, isError: true };
            }
            const data = result.data;
            const linksText = data.links
                .map((l, i) => `${i + 1}. [${l.text}](${l.url})`)
                .join('\n');
            return {
                content: linksText || '(no links found)',
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Extract links error: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=browser-extract-links.js.map