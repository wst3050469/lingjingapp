export interface VectorMemoryConfig {
  enabled: boolean;
  adapter: 'sqlite-vss' | 'in-memory';
  embeddingDimension: number;
  defaultTopK: number;
  encryptionEnabled: boolean;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface IVectorStoreAdapter {
  upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>;
  search(queryVector: number[], topK: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  initialize(): Promise<void>;
}

export interface IVectorMemoryStore {
  store(content: string, metadata: Record<string, unknown>): Promise<string>;
  search(query: string, topK?: number): Promise<VectorSearchResult[]>;
  remove(id: string): Promise<void>;
  syncFromMemory(memoryEntries: Array<{ id: string; content: string; category: string }>): Promise<void>;
  healthCheck(): { healthy: boolean };
}

export const DEFAULT_VECTOR_MEMORY_CONFIG: VectorMemoryConfig = {
  enabled: true,
  adapter: 'in-memory',
  embeddingDimension: 1536,
  defaultTopK: 5,
  encryptionEnabled: true,
};
