import type { VectorMemoryConfig, IVectorStoreAdapter, IVectorMemoryStore, VectorSearchResult } from './types.js';
import type { IEventBus } from '../event-bus/types.js';
import { DEFAULT_VECTOR_MEMORY_CONFIG } from './types.js';
import { InMemoryVectorAdapter } from './adapters/in-memory-adapter.js';

export type EmbedFn = (text: string) => Promise<number[]>;

export class VectorMemoryStore implements IVectorMemoryStore {
  private config: VectorMemoryConfig;
  private adapter: IVectorStoreAdapter;
  private eventBus: IEventBus | null = null;
  private contentById = new Map<string, string>();
  private embedFn: EmbedFn | null = null;

  constructor(config?: Partial<VectorMemoryConfig>, adapter?: IVectorStoreAdapter) {
    this.config = { ...DEFAULT_VECTOR_MEMORY_CONFIG, ...config };
    this.adapter = adapter ?? new InMemoryVectorAdapter();
  }

  setEventBus(eventBus: IEventBus): void {
    this.eventBus = eventBus;
  }

  setEmbedFn(fn: EmbedFn): void {
    this.embedFn = fn;
  }

  async initializeAdapter(): Promise<void> {
    await this.adapter.initialize();
  }

  async store(content: string, metadata: Record<string, unknown>): Promise<string> {
    const id = `vec_${Date.now()}_${hashString(content).toString(36)}`;
    const vector = await this.embed(content);
    const enrichedMetadata = { ...metadata, content };

    this.contentById.set(id, content);
    await this.adapter.upsert(id, vector, enrichedMetadata);

    this.eventBus?.publish('vector:synced', { id, content, metadata: enrichedMetadata }, 'VectorMemoryStore');

    return id;
  }

  async search(query: string, topK?: number): Promise<VectorSearchResult[]> {
    const k = topK ?? this.config.defaultTopK;
    const queryVector = await this.embed(query);
    return this.adapter.search(queryVector, k);
  }

  async remove(id: string): Promise<void> {
    this.contentById.delete(id);
    await this.adapter.delete(id);
  }

  async syncFromMemory(memoryEntries: Array<{ id: string; content: string; category: string }>): Promise<void> {
    for (const entry of memoryEntries) {
      const vector = await this.embed(entry.content);
      await this.adapter.upsert(entry.id, vector, { content: entry.content, category: entry.category });
      this.contentById.set(entry.id, entry.content);
    }
  }

  healthCheck(): { healthy: boolean } {
    return { healthy: this.config.enabled };
  }

  private async embed(text: string): Promise<number[]> {
    if (this.embedFn) {
      try {
        return await this.embedFn(text);
      } catch (err) {
        console.warn('[VectorMemory] External embed failed, falling back to hash:', err instanceof Error ? err.message : String(err));
      }
    }
    return this.fallbackEmbed(text);
  }

  private fallbackEmbed(text: string): number[] {
    const dim = this.config.embeddingDimension;
    const vector = new Array<number>(dim);

    for (let i = 0; i < dim; i++) {
      const charCode = text.charCodeAt(i % text.length);
      vector[i] = (charCode % 100) / 100;
    }

    return vector;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(str.length - 1 - i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
