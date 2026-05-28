"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRememberVectorTool = createRememberVectorTool;
const parameters = {
    type: 'object',
    properties: {
        content: { type: 'string', description: 'Content to remember' },
        metadata: { type: 'object', description: 'Optional metadata' },
    },
    required: ['content'],
};
function createRememberVectorTool(store) {
    return {
        name: 'remember_vector',
        description: 'Store content in vector memory for semantic retrieval',
        parameters,
        async execute(params, _context) {
            try {
                const content = params.content;
                const metadata = params.metadata ?? {};
                const id = await store.store(content, metadata);
                return { content: `Remembered with id: ${id}` };
            }
            catch (err) {
                return { content: `Failed to remember: ${err.message}`, isError: true };
            }
        },
    };
}
//# sourceMappingURL=remember-vector.js.map