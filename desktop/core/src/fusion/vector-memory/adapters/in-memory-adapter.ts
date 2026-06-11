import type { VectorSearchResult, IVectorStoreAdapter } from '../types.js';

interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export class InMemoryVectorAdapter implements IVectorStoreAdapter {
  private store = new Map<string, VectorEntry>();

  async initialize(): Promise<void> {}

  async upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void> {
    this.store.set(id, { id, vector, metadata });
  }

  async search(queryVector: number[], topK: number): Promise<VectorSearchResult[]> {
    const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];

    for (const entry of this.store.values()) {
      const score = cosineSimilarity(queryVector, entry.vector);
      results.push({ id: entry.id, score, metadata: entry.metadata });
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK).map((r) => ({
      id: r.id,
      content: (r.metadata.content as string) ?? '',
      score: r.score,
      metadata: r.metadata,
    }));
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
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
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}
