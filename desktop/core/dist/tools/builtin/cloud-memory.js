// Cloud memory search tool - AI can search cloud memories across devices
// Direct HTTP to cloud server, no local DB dependency
const CLOUD_URL = process.env.LINGJING_CLOUD_URL || 'https://ide.zhejiangjinmo.com';
const API_KEY = process.env.LINGJING_CLOUD_KEY || 'lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8';
let _enabled = true;
export function initCloudMemoryTool(enabled) {
    if (enabled !== undefined)
        _enabled = enabled;
}
async function cloudFetch(path, method = 'GET', body) {
    const res = await fetch(`${CLOUD_URL}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cloud API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}
export const cloudMemorySearchTool = {
    name: 'cloud_memory_search',
    description: `Search the cloud memory system for knowledge shared across LingJing devices. Use this to find user preferences, project context, and past decisions that may have been recorded by other instances or sessions. Cloud URL: ${CLOUD_URL}`,
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action: "search" to find memories, "add" to create one, "delete" to remove.',
                enum: ['search', 'add', 'delete'],
            },
            query: {
                type: 'string',
                description: 'Search query (for "search" action)',
            },
            title: {
                type: 'string',
                description: 'Memory title (for "add" action)',
            },
            content: {
                type: 'string',
                description: 'Memory content (for "add" action)',
            },
            category: {
                type: 'string',
                description: 'Category: "preference", "project", "workflow", "issue", "knowledge". Default: "knowledge"',
            },
            scope: {
                type: 'string',
                description: 'Scope: "global" (all projects) or "project" (current project only). Default: "global"',
                enum: ['global', 'project'],
            },
            id: {
                type: 'string',
                description: 'Memory ID (for "delete" action)',
            },
        },
        required: [],
    },
    async execute(params, _context) {
        if (!_enabled) {
            return { content: 'Cloud memory system is disabled. Set LINGJING_CLOUD_URL to enable.', isError: true };
        }
        // Auto-detect action from provided params (AI layer may omit 'action')
        let action = params.action;
        if (!action) {
            if (params.query) action = 'search';
            else if (params.title && params.content) action = 'add';
            else if (params.id) action = 'delete';
            else action = 'search'; // default
        }
        // Map AI-layer top_k to limit
        const limit = params.top_k || params.limit || 10;
        try {
            switch (action) {
                case 'search': {
                    const query = params.query;
                    if (!query)
                        return { content: 'Error: "query" is required for "search" action.', isError: true };
                    const results = await cloudFetch(`/memories?action=search&query=${encodeURIComponent(query)}&limit=${limit}`);
                    if (!Array.isArray(results) || results.length === 0) {
                        return { content: `No cloud memories found matching "${query}".` };
                    }
                    const lines = results.map((r) => `[${r.id}] (${r.category}/${r.scope}) ${r.title}\n  ${(r.content || '').slice(0, 200)}`);
                    return { content: `Found ${results.length} cloud memories:\n\n${lines.join('\n\n')}` };
                }
                case 'add': {
                    const title = params.title;
                    const content = params.content;
                    if (!title || !content)
                        return { content: 'Error: "title" and "content" are required.', isError: true };
                    const r = await cloudFetch('/memories', 'POST', {
                        title, content,
                        category: params.category || 'knowledge',
                        scope: params.scope || 'global',
                    });
                    return { content: `Cloud memory saved. ID: ${r.id}\nTitle: ${title}` };
                }
                case 'delete': {
                    const id = params.id;
                    if (!id)
                        return { content: 'Error: "id" is required for "delete" action.', isError: true };
                    await cloudFetch(`/memories/${encodeURIComponent(id)}`, 'DELETE');
                    return { content: `Cloud memory "${id}" deleted.` };
                }
                default:
                    return { content: `Unknown action: "${action}". Use "search", "add", or "delete".`, isError: true };
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: `Cloud memory operation failed: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=cloud-memory.js.map