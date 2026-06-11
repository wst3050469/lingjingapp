import type { VectorMemoryConfig, IVectorStoreAdapter, IVectorMemoryStore, VectorSearchResult } from './types.js';
import type { IEventBus } from '../event-bus/types.js';
export type EmbedFn = (text: string) => Promise<number[]>;
export declare class VectorMemoryStore implements IVectorMemoryStore {
    private config;
    private adapter;
    private eventBus;
    private contentById;
    private embedFn;
    constructor(config?: Partial<VectorMemoryConfig>, adapter?: IVectorStoreAdapter);
    setEventBus(eventBus: IEventBus): void;
    setEmbedFn(fn: EmbedFn): void;
    initializeAdapter(): Promise<void>;
    store(content: string, metadata: Record<string, unknown>): Promise<string>;
    search(query: string, topK?: number): Promise<VectorSearchResult[]>;
    remove(id: string): Promise<void>;
    syncFromMemory(memoryEntries: Array<{
        id: string;
        content: string;
        category: string;
    }>): Promise<void>;
    healthCheck(): {
        healthy: boolean;
    };
    private embed;
    private fallbackEmbed;
}
//# sourceMappingURL=vector-memory-store.d.ts.map