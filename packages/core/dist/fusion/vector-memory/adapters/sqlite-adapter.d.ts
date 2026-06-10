import type { IVectorStoreAdapter, VectorSearchResult } from '../types.js';
export declare class SqliteVectorAdapter implements IVectorStoreAdapter {
    private db;
    private tableName;
    private store;
    private loaded;
    constructor(db: any, tableName?: string);
    initialize(): Promise<void>;
    upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>;
    search(queryVector: number[], topK: number): Promise<VectorSearchResult[]>;
    delete(id: string): Promise<void>;
    private loadAll;
    get size(): number;
}
//# sourceMappingURL=sqlite-adapter.d.ts.map