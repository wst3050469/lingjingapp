// codebase_search tool - Semantic code search using embeddings
// Uses module-level injection pattern for the search function
let _searchFn = null;
/**
 * Initialize the codebase_search tool with the search function from electron layer.
 */
export function initCodebaseSearchTool(searchFn) {
    _searchFn = searchFn;
}
export const codebaseSearchTool = {
    name: 'codebase_search',
    description: 'Search the codebase using semantic similarity. Use this for natural language queries like "user authentication logic", "database connection handling", "error logging", etc. Results are ranked by semantic relevance. The codebase must be indexed first (happens automatically when a workspace is opened).',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Natural language search query describing the code you are looking for.',
            },
            top_k: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10, max: 30).',
            },
            file_pattern: {
                type: 'string',
                description: 'Optional file glob pattern to filter results, e.g. "*.ts", "src/**/*.tsx".',
            },
        },
        required: ['query'],
    },
    async execute(params, context) {
        const query = params.query;
        const topK = Math.min(Math.max(params.top_k || 10, 1), 30);
        const filePattern = params.file_pattern;
        if (!query?.trim()) {
            return { content: 'Error: query parameter is required.', isError: true };
        }
        if (!_searchFn) {
            return {
                content: 'Codebase search is not available. The embedding service has not been initialized.',
                isError: true,
            };
        }
        try {
            const results = await _searchFn(query, context.workingDirectory, topK, filePattern);
            if (results.length === 0) {
                return {
                    content: 'No results found. The codebase may not be indexed yet. Try opening the workspace first, or check that relevant files exist.',
                    isError: false,
                };
            }
            // Format results
            const lines = [];
            lines.push(`Found ${results.length} result${results.length > 1 ? 's' : ''} for: "${query}"`);
            lines.push('');
            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                const score = (r.similarity * 100).toFixed(1);
                lines.push(`--- Result ${i + 1} (${score}% match) ---`);
                lines.push(`File: ${r.filePath}`);
                lines.push(`Lines: ${r.chunkStart}-${r.chunkEnd}`);
                lines.push('');
                // Truncate long chunks
                const chunkLines = r.chunkText.split('\n');
                if (chunkLines.length > 40) {
                    lines.push(chunkLines.slice(0, 35).join('\n'));
                    lines.push(`... (${chunkLines.length - 35} more lines)`);
                }
                else {
                    lines.push(r.chunkText);
                }
                lines.push('');
            }
            return { content: lines.join('\n'), isError: false };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { content: `Codebase search error: ${message}`, isError: true };
        }
    },
};
//# sourceMappingURL=codebase-search.js.map