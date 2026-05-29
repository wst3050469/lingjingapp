import { DEFAULT_VECTOR_MEMORY_CONFIG } from './types.js';
import { InMemoryVectorAdapter } from './adapters/in-memory-adapter.js';
export class VectorMemoryStore {
    config;
    adapter;
    eventBus = null;
    contentById = new Map();
    embedFn = null;
    constructor(config, adapter) {
        this.config = { ...DEFAULT_VECTOR_MEMORY_CONFIG, ...config };
        this.adapter = adapter ?? new InMemoryVectorAdapter();
    }
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
    setEmbedFn(fn) {
        this.embedFn = fn;
    }
    async initializeAdapter() {
        await this.adapter.initialize();
    }
    async store(content, metadata) {
        const id = `vec_${Date.now()}_${hashString(content).toString(36)}`;
        const vector = await this.embed(content);
        const enrichedMetadata = { ...metadata, content };
        this.contentById.set(id, content);
        await this.adapter.upsert(id, vector, enrichedMetadata);
        this.eventBus?.publish('vector:synced', { id, content, metadata: enrichedMetadata }, 'VectorMemoryStore');
        return id;
    }
    async search(query, topK) {
        const k = topK ?? this.config.defaultTopK;
        const queryVector = await this.embed(query);
        return this.adapter.search(queryVector, k);
    }
    async remove(id) {
        this.contentById.delete(id);
        await this.adapter.delete(id);
    }
    async syncFromMemory(memoryEntries) {
        for (const entry of memoryEntries) {
            const vector = await this.embed(entry.content);
            await this.adapter.upsert(entry.id, vector, { content: entry.content, category: entry.category });
            this.contentById.set(entry.id, entry.content);
        }
    }
    healthCheck() {
        return { healthy: this.config.enabled };
    }
    async embed(text) {
        if (this.embedFn) {
            try {
                return await this.embedFn(text);
            }
            catch (err) {
                console.warn('[VectorMemory] External embed failed, falling back to hash:', err instanceof Error ? err.message : String(err));
            }
        }
        return this.fallbackEmbed(text);
    }
    fallbackEmbed(text) {
        const dim = this.config.embeddingDimension;
        const vector = new Array(dim);
        for (let i = 0; i < dim; i++) {
            const charCode = text.charCodeAt(i % text.length);
            vector[i] = (charCode % 100) / 100;
        }
        return vector;
    }
}
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(str.length - 1 - i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}
//# sourceMappingURL=vector-memory-store.js.map