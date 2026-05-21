const parameters = {
    type: 'object',
    properties: {
        query: { type: 'string', description: 'Search query' },
        topK: { type: 'number', description: 'Number of results to return' },
    },
    required: ['query'],
};
export function createRecallVectorTool(store) {
    return {
        name: 'recall_vector',
        description: 'Search vector memory for semantically similar content',
        parameters,
        async execute(params, _context) {
            try {
                const query = params.query;
                const topK = params.topK ?? 5;
                const results = await store.search(query, topK);
                if (results.length === 0) {
                    return { content: 'No results found' };
                }
                const formatted = results
                    .map((r, i) => `${i + 1}. [${r.score.toFixed(3)}] ${r.content}`)
                    .join('\n');
                return { content: formatted };
            }
            catch (err) {
                return { content: `Failed to recall: ${err.message}`, isError: true };
            }
        },
    };
}
//# sourceMappingURL=recall-vector.js.map