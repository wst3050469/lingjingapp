import type { VectorSearchResult, IVectorStoreAdapter } from '../types.js';
export declare class InMemoryVectorAdapter implements IVectorStoreAdapter {
    private store;
    initialize(): Promise<void>;
    upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>;
    search(queryVector: number[], topK: number): Promise<VectorSearchResult[]>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=in-memory-adapter.d.ts.map