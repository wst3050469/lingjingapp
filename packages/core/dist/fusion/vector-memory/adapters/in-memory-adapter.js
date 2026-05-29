export class InMemoryVectorAdapter {
    store = new Map();
    async initialize() { }
    async upsert(id, vector, metadata) {
        this.store.set(id, { id, vector, metadata });
    }
    async search(queryVector, topK) {
        const results = [];
        for (const entry of this.store.values()) {
            const score = cosineSimilarity(queryVector, entry.vector);
            results.push({ id: entry.id, score, metadata: entry.metadata });
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK).map((r) => ({
            id: r.id,
            content: r.metadata.content ?? '',
            score: r.score,
            metadata: r.metadata,
        }));
    }
    async delete(id) {
        this.store.delete(id);
    }
}
function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0)
        return 0;
    return dotProduct / denominator;
}
//# sourceMappingURL=in-memory-adapter.js.map