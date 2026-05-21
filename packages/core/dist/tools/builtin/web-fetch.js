// Web Fetch tool - fetch and extract content from URLs
import { truncateString } from '../../utils/truncate.js';
const MAX_CONTENT_LENGTH = 50_000;
export const webFetchTool = {
    name: 'web_fetch',
    description: 'Fetch content from a URL. Returns the text content of the page (HTML tags stripped). Useful for reading documentation, APIs, etc.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL to fetch',
            },
        },
        required: ['url'],
    },
    async execute(params, context) {
        const url = params.url;
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'LingJing/1.0 (AI Coding Assistant)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
                },
                signal: context.signal,
                redirect: 'follow',
            });
            if (!response.ok) {
                return { content: `Failed to fetch ${url}: HTTP ${response.status}`, isError: true };
            }
            const contentType = response.headers.get('content-type') ?? '';
            const text = await response.text();
            let content;
            if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
                content = stripHtml(text);
            }
            else {
                content = text;
            }
            content = truncateString(content, MAX_CONTENT_LENGTH);
            return { content: `Content from ${url}:\n\n${content}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Error fetching ${url}: ${msg}`, isError: true };
        }
    },
};
function stripHtml(html) {
    return html
        // Remove script and style blocks
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Convert common block elements to newlines
        .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
        .replace(/<br[^>]*\/?>/gi, '\n')
        // Remove all remaining tags
        .replace(/<[^>]+>/g, '')
        // Decode common HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        // Collapse whitespace
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
//# sourceMappingURL=web-fetch.js.map