// Indexing pipeline for codebase_search
// Orchestrates file scanning, chunking, embedding, and vector storage
// Supports incremental indexing by comparing file mtimes

import type { Database as SqlJsDatabase } from 'sql.js';
import { scanAndChunk, type AppConfig } from '@codepilot/core';
import { createEmbeddingService, type EmbeddingService } from './embedding-service.js';
import { VectorStore, type SearchResult } from './vector-store.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface IndexingProgress {
  phase: 'scanning' | 'chunking' | 'embedding' | 'storing' | 'done' | 'error';
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  processedChunks: number;
  message: string;
  /** Per-file error (non-fatal, continues indexing) */
  fileError?: string;
}

export type ProgressCallback = (progress: IndexingProgress) => void;

// Active indexing state per workspace
const activeIndexing = new Map<string, { abort: boolean }>();

// VectorStore cache per workspace
const vectorStores = new Map<string, VectorStore>();

// Embedding service cache
let cachedEmbeddingService: EmbeddingService | null = null;
let cachedConfigHash = '';

function getConfigHash(config: AppConfig): string {
  return JSON.stringify({
    apiKeys: config.apiKeys,
    ollama: config.ollama,
    custom: config.custom,
    // Track provider info so switching providers invalidates the cached embedding service
    // even if the same API key is reused (e.g., switching from deepseek to qwen)
    provider: (config as any).provider,
  });
}

async function getEmbeddingService(config: AppConfig): Promise<EmbeddingService> {
  const hash = getConfigHash(config);
  if (cachedEmbeddingService && cachedConfigHash === hash) {
    return cachedEmbeddingService;
  }
  cachedEmbeddingService = await createEmbeddingService(config);
  cachedConfigHash = hash;
  return cachedEmbeddingService;
}

function getVectorStore(db: SqlJsDatabase, saveDb: () => Promise<void>, workspace: string): VectorStore {
  let store = vectorStores.get(workspace);
  if (!store) {
    store = new VectorStore(db, saveDb, workspace);
    vectorStores.set(workspace, store);
  }
  return store;
}

/** Load ignore patterns for a workspace */
async function loadIgnorePatterns(workspace: string): Promise<string[]> {
  const patterns: string[] = [];

  for (const fileName of ['.gitignore', '.lingjingignore']) {
    const filePath = join(workspace, fileName);
    if (existsSync(filePath)) {
      try {
        const content = await readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        patterns.push(...lines);
      } catch {
        // ignore read errors
      }
    }
  }

  return patterns;
}

/**
 * Run the indexing pipeline for a workspace.
 * Performs incremental indexing: only re-indexes changed files.
 */
export async function runIndexingPipeline(
  workspace: string,
  config: AppConfig,
  db: SqlJsDatabase,
  saveDb: () => Promise<void>,
  onProgress?: ProgressCallback,
): Promise<{ success: boolean; chunksIndexed: number; error?: string }> {
  // Abort any existing indexing for this workspace
  const existing = activeIndexing.get(workspace);
  if (existing) {
    existing.abort = true;
  }

  const state = { abort: false };
  activeIndexing.set(workspace, state);

  const embeddingService = await getEmbeddingService(config);
  const vectorStore = getVectorStore(db, saveDb, workspace);
  const existingMeta = vectorStore.getFileMetadata();

  let totalFiles = 0;
  let processedFiles = 0;
  let totalChunks = 0;
  let processedChunks = 0;

  try {
    onProgress?.({
      phase: 'scanning',
      totalFiles: 0, processedFiles: 0,
      totalChunks: 0, processedChunks: 0,
      message: 'Scanning workspace files...',
    });

    const ignorePatterns = await loadIgnorePatterns(workspace);

    // Collect files that need indexing (changed or new)
    const filesToIndex: Array<{ file: string; mtime: string; chunks: Array<{ startLine: number; endLine: number; text: string }> }> = [];
    const seenFiles = new Set<string>();
    let scannedCount = 0;

// @ts-expect-error - TS2554: Expected 0 arguments, but got 2
    for await (const { file, mtime, chunks } of scanAndChunk(workspace, { ignorePatterns })) {
      if (state.abort) return { success: false, chunksIndexed: 0, error: 'Aborted' };

      seenFiles.add(file);
      const meta = existingMeta.get(file);

      // Skip if file hasn't changed
      if (meta && meta.mtime === mtime) {
        scannedCount++;
        // Report scanning progress every 100 files
        if (scannedCount % 100 === 0) {
          onProgress?.({
            phase: 'scanning',
            totalFiles: scannedCount,
            processedFiles: scannedCount,
            totalChunks: 0,
            processedChunks: 0,
            message: `Scanning: ${scannedCount} files checked...`,
          });
        }
        continue;
      }

      filesToIndex.push({ file, mtime, chunks });
      totalChunks += chunks.length;
      totalFiles++;
      scannedCount++;
    }

    // Remove files that no longer exist
    for (const [filePath] of existingMeta) {
      if (!seenFiles.has(filePath)) {
        await vectorStore.removeFile(filePath);
      }
    }

    if (filesToIndex.length === 0) {
      onProgress?.({
        phase: 'done',
        totalFiles: 0, processedFiles: 0,
        totalChunks: 0, processedChunks: 0,
        message: 'Index is up to date',
      });
      activeIndexing.delete(workspace);
      return { success: true, chunksIndexed: vectorStore.getChunkCount() };
    }

    onProgress?.({
      phase: 'embedding',
      totalFiles, processedFiles: 0,
      totalChunks, processedChunks: 0,
      message: `Indexing ${totalFiles} files (${totalChunks} chunks)...`,
    });

    // Process files in batches for embedding
    const EMBED_BATCH = 50; // chunks per embedding batch
    const CONCURRENCY = config.indexing?.concurrency ?? 5; // from AppConfig

    /**
     * Process a single file: embed its chunks and store results.
     * Returns true if the file was successfully indexed, false on error/skip.
     */
    async function processFile(fileData) {
      if (state.abort) return false;

      const chunkTexts = fileData.chunks.map(c => `${fileData.file}\n${c.text}`);
      const embeddings: Float32Array[] = [];

      // Batch embed chunks for this file
      for (let i = 0; i < chunkTexts.length; i += EMBED_BATCH) {
        if (state.abort) return false;

        const batch = chunkTexts.slice(i, i + EMBED_BATCH);
        try {
          const batchEmbeddings = await embeddingService.embed(batch);
          embeddings.push(...batchEmbeddings);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Embedding error for ${fileData.file}:`, errMsg);
          // Report per-file error through progress callback
          onProgress?.({
            phase: 'embedding',
            totalFiles,
            processedFiles,
            totalChunks,
            processedChunks,
            message: `Embedding failed: ${fileData.file}`,
            fileError: errMsg,
          });
          return false;
        }
      }

      // Only store if all chunks were embedded
      if (embeddings.length === fileData.chunks.length) {
        const chunksWithEmbeddings = fileData.chunks.map((c, i) => ({
          startLine: c.startLine,
          endLine: c.endLine,
          text: c.text,
          embedding: embeddings[i],
        }));

        await vectorStore.storeFileEmbeddings(fileData.file, fileData.mtime, chunksWithEmbeddings);
      }

      processedChunks += embeddings.length;
      return true;
    }

    // Concurrent pool: process up to CONCURRENCY files at once
    let currentFileIndex = 0;

    async function embeddingWorker() {
      while (!state.abort) {
        const idx = currentFileIndex++;
        if (idx >= filesToIndex.length) return;

        const success = await processFile(filesToIndex[idx]);
        if (success) {
          processedFiles++;
        }

        onProgress?.({
          phase: 'storing',
          totalFiles, processedFiles,
          totalChunks, processedChunks,
          message: `Indexed: ${processedFiles}/${totalFiles} files`,
        });
      }
    }

    // Start N concurrent workers
    const workerCount = Math.min(CONCURRENCY, filesToIndex.length);
    const workers = [];
    for (let i = 0; i < workerCount; i++) {
      workers.push(embeddingWorker() as unknown as never);
    }
    await Promise.all(workers);
    if (state.abort) return { success: false, chunksIndexed: 0, error: 'Aborted' };

    // Flush to disk
    await vectorStore.flush();

    const finalCount = vectorStore.getChunkCount();
    onProgress?.({
      phase: 'done',
      totalFiles, processedFiles,
      totalChunks: finalCount, processedChunks: finalCount,
      message: `Indexing complete: ${finalCount} chunks from ${processedFiles} files`,
    });

    activeIndexing.delete(workspace);
    return { success: true, chunksIndexed: finalCount };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Indexing pipeline error:', err);
    onProgress?.({
      phase: 'error',
      totalFiles, processedFiles,
      totalChunks, processedChunks,
      message: `Indexing error: ${message}`,
    });
    activeIndexing.delete(workspace);
    return { success: false, chunksIndexed: 0, error: message };
  }
}

/**
 * Search the indexed codebase for semantically similar code.
 * This is the function injected into the codebase_search tool.
 */
export async function searchCodebase(
  workspace: string,
  query: string,
  config: AppConfig,
  db: SqlJsDatabase,
  saveDb: () => Promise<void>,
  topK: number = 10,
  filePattern?: string,
): Promise<SearchResult[]> {
  const embeddingService = await getEmbeddingService(config);
  const vectorStore = getVectorStore(db, saveDb, workspace);

  // Check if we have any indexed data
  if (vectorStore.getChunkCount() === 0) {
    return [];
  }

  // Embed the query
  const [queryEmbedding] = await embeddingService.embed([query]);

  // Search (with dimension validation inside vectorStore.search)
  return vectorStore.search(queryEmbedding, topK, filePattern);
}

/**
 * Abort any active indexing for a workspace.
 */
export function abortIndexing(workspace: string): void {
  const state = activeIndexing.get(workspace);
  if (state) {
    state.abort = true;
  }
}

/**
 * Check if indexing is active for a workspace.
 */
export function isIndexing(workspace: string): boolean {
  return activeIndexing.has(workspace);
}
