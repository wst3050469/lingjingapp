// Vector store for codebase_search
// Stores and retrieves embedding vectors using SQLite BLOB storage
// Uses in-memory cache for fast cosine similarity search

import type { Database as SqlJsDatabase } from 'sql.js';

export interface VectorEntry {
  id: number;
  filePath: string;
  chunkStart: number;
  chunkEnd: number;
  chunkText: string;
  embedding: Float32Array;
}

export interface SearchResult {
  filePath: string;
  chunkStart: number;
  chunkEnd: number;
  chunkText: string;
  similarity: number;
}

export class VectorStore {
  private db: SqlJsDatabase;
  private saveDb: () => Promise<void>;
  private workspace: string;

  // In-memory cache: loaded on first query, invalidated on index update
  private cache: VectorEntry[] | null = null;

  constructor(db: SqlJsDatabase, saveDb: () => Promise<void>, workspace: string) {
    this.db = db;
    this.saveDb = saveDb;
    this.workspace = workspace;
    // Ensure metadata table exists on construction
    this.ensureMetaTable();
  }

  /** Ensure metadata table exists */
  private ensureMetaTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS index_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }

  /** Get stored embedding dimensions for this workspace, or null if not set */
  getStoredDimensions(): number | null {
    const stmt = this.db.prepare(
      "SELECT value FROM index_meta WHERE key = ?"
    );
    stmt.bind([`${this.workspace}:embedding_dimensions`]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string };
      stmt.free();
      return parseInt(row.value, 10);
    }
    stmt.free();
    return null;
  }

  /** Set stored embedding dimensions for this workspace */
  private setStoredDimensions(dimensions: number): void {
    this.db.run(
      "INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)",
      [`${this.workspace}:embedding_dimensions`, String(dimensions)]
    );
  }

  /** Invalidate the in-memory cache (call after indexing) */
  invalidateCache(): void {
    this.cache = null;
  }

  /** Store embeddings for a file (replaces any existing entries for that file) */
  async storeFileEmbeddings(
    filePath: string,
    mtime: string,
    chunks: Array<{
      startLine: number;
      endLine: number;
      text: string;
      embedding: Float32Array;
    }>
  ): Promise<void> {
    // Validate chunk embedding dimensions
    if (chunks.length > 0) {
      const dim = chunks[0].embedding.length;
      // Check consistency with previously stored dimensions
      const storedDim = this.getStoredDimensions();
      if (storedDim !== null && storedDim !== dim) {
        console.warn(
          `[VectorStore] Embedding dimension mismatch: stored=${storedDim}, new=${dim}. ` +
          `Consider re-indexing after changing the embedding model.`
        );
      }
    }

    // Delete old embeddings for this file
    this.db.run(
      'DELETE FROM embeddings WHERE workspace = ? AND file_path = ?',
      [this.workspace, filePath]
    );

    // Batch insert in a single transaction for performance
    this.db.run('BEGIN');
    try {
      for (const chunk of chunks) {
        const buffer = Buffer.from(chunk.embedding.buffer);
        this.db.run(
          `INSERT INTO embeddings (workspace, file_path, chunk_start, chunk_end, chunk_text, embedding, file_mtime)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [this.workspace, filePath, chunk.startLine, chunk.endLine, chunk.text, buffer, mtime]
        );
      }

      // Update file index meta
      this.db.run(
        `INSERT OR REPLACE INTO file_index_meta (workspace, file_path, mtime, chunk_count)
         VALUES (?, ?, ?, ?)`,
        [this.workspace, filePath, mtime, chunks.length]
      );

      this.db.run('COMMIT');
    } catch (err) {
      this.db.run('ROLLBACK');
      throw err;
    }

    // Store embedding dimensions if we have chunks
    if (chunks.length > 0 && this.getStoredDimensions() === null) {
      this.setStoredDimensions(chunks[0].embedding.length);
    }

    this.cache = null; // invalidate cache
  }

  /** Remove embeddings for files that no longer exist */
  async removeFile(filePath: string): Promise<void> {
    this.db.run(
      'DELETE FROM embeddings WHERE workspace = ? AND file_path = ?',
      [this.workspace, filePath]
    );
    this.db.run(
      'DELETE FROM file_index_meta WHERE workspace = ? AND file_path = ?',
      [this.workspace, filePath]
    );
    this.cache = null;
  }

  /** Get file index metadata for incremental indexing */
  getFileMetadata(): Map<string, { mtime: string; chunkCount: number }> {
    const result = new Map<string, { mtime: string; chunkCount: number }>();
    const stmt = this.db.prepare(
      'SELECT file_path, mtime, chunk_count FROM file_index_meta WHERE workspace = ?'
    );
    stmt.bind([this.workspace]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as { file_path: string; mtime: string; chunk_count: number };
      result.set(row.file_path, { mtime: row.mtime, chunkCount: row.chunk_count });
    }
    stmt.free();
    return result;
  }

  /** Load all vectors into memory cache */
  private loadCache(): VectorEntry[] {
    if (this.cache) return this.cache;

    const entries: VectorEntry[] = [];
    const stmt = this.db.prepare(
      'SELECT id, file_path, chunk_start, chunk_end, chunk_text, embedding FROM embeddings WHERE workspace = ?'
    );
    stmt.bind([this.workspace]);

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      const embeddingBuf = row.embedding as Uint8Array;
      const embedding = new Float32Array(
        embeddingBuf.buffer,
        embeddingBuf.byteOffset,
        embeddingBuf.byteLength / 4
      );

      entries.push({
        id: row.id as number,
        filePath: row.file_path as string,
        chunkStart: row.chunk_start as number,
        chunkEnd: row.chunk_end as number,
        chunkText: row.chunk_text as string,
        embedding,
      });
    }
    stmt.free();

    this.cache = entries;
    return entries;
  }

  /** Search for similar chunks using cosine similarity */
  search(
    queryEmbedding: Float32Array,
    topK: number = 10,
    filePattern?: string
  ): SearchResult[] {
    const entries = this.loadCache();
    if (entries.length === 0) return [];

    // Validate embedding dimension consistency
    const storedDim = this.getStoredDimensions();
    if (storedDim !== null && storedDim !== queryEmbedding.length) {
      console.warn(
        `[VectorStore] Query embedding dimension (${queryEmbedding.length}) ` +
        `does not match stored dimension (${storedDim}). ` +
        `This likely means the embedding model/provider changed since indexing. ` +
        `Please re-index the codebase.`
      );
      return [];
    }

    // Optional file pattern filter
    let filtered = entries;
    if (filePattern) {
      const pattern = filePattern.toLowerCase();
      filtered = entries.filter(e => {
        const fp = e.filePath.toLowerCase();
        // Support simple glob: *.ts, src/**/*.ts
        if (pattern.startsWith('*.')) {
          return fp.endsWith(pattern.slice(1));
        }
        if (pattern.includes('*')) {
          const regex = new RegExp(
            '^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$'
          );
          return regex.test(fp);
        }
        return fp.includes(pattern);
      });
    }

    // Compute cosine similarity for all entries
    const scored: Array<{ entry: VectorEntry; similarity: number }> = [];

    for (const entry of filtered) {
      // All stored embeddings must have the same dimension as the query by now
      const sim = cosineSimilarity(queryEmbedding, entry.embedding);
      scored.push({ entry, similarity: sim });
    }

    // Sort by similarity descending
    scored.sort((a, b) => b.similarity - a.similarity);

    // Return top-k
    return scored.slice(0, topK).map(({ entry, similarity }) => ({
      filePath: entry.filePath,
      chunkStart: entry.chunkStart,
      chunkEnd: entry.chunkEnd,
      chunkText: entry.chunkText,
      similarity,
    }));
  }

  /** Get total number of indexed chunks */
  getChunkCount(): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM embeddings WHERE workspace = ?'
    );
    stmt.bind([this.workspace]);
    stmt.step();
    const row = stmt.getAsObject() as { cnt: number };
    stmt.free();
    return row.cnt;
  }

  /** Flush changes to disk */
  async flush(): Promise<void> {
    await this.saveDb();
  }
}

/** Compute cosine similarity between two vectors */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  // Both vectors should have the same dimension (verified by search())
  // Use the shorter length as safety net but dimensions should match
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dot / denominator;
}
