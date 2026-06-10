// Embedding service for codebase_search
// Supports OpenAI-compatible API, Ollama embeddings, and TF-IDF fallback

import type { AppConfig } from '@codepilot/core';

export interface EmbeddingResult {
  vector: Float32Array;
  dimensions: number;
}

export interface EmbeddingService {
  embed(texts: string[]): Promise<Float32Array[]>;
  dimensions: number;
  type: 'api' | 'tfidf';
}

// --- OpenAI-compatible Embedding Provider ---

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage?: { prompt_tokens: number; total_tokens: number };
}

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_DIMENSIONS = 1536;
const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 200; // ms between batches
const EMBED_TIMEOUT = 30_000; // 30s timeout for API calls (reduced from 60s)
const OLLAMA_TIMEOUT = 15_000; // 15s timeout for local Ollama calls (reduced from 30s)
const PROBE_TIMEOUT = 5_000; // 5s quick probe before committing to an API provider

/**
 * Fetch with timeout using AbortController.
 * Throws AbortError if the request takes longer than timeoutMs.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = EMBED_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenAIEmbeddings(
  texts: string[],
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<Float32Array[]> {
  const results: Float32Array[] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
    }

    const batch = texts.slice(i, i + BATCH_SIZE);
    const url = `${baseUrl}/embeddings`;

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ input: batch, model }),
        }, EMBED_TIMEOUT);

        if (response.status === 429) {
          // Rate limited - exponential backoff
          const delay = Math.min(1000 * Math.pow(2, retries), 10000);
          await new Promise(r => setTimeout(r, delay));
          retries++;
          continue;
        }

        if (!response.ok) {
          throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as OpenAIEmbeddingResponse;
        for (const item of data.data) {
          results[i + item.index] = new Float32Array(item.embedding);
        }
        break;
      } catch (err) {
        // If it's a timeout/abort error, throw immediately (don't retry)
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error(`Embedding API timeout after ${EMBED_TIMEOUT}ms: ${baseUrl}/embeddings`);
        }
        if (retries >= maxRetries - 1) throw err;
        retries++;
        await new Promise(r => setTimeout(r, 1000 * retries));
      }
    }
  }

  return results;
}

function createOpenAIEmbeddingService(apiKey: string, baseUrl: string, model?: string): EmbeddingService {
  return {
    dimensions: OPENAI_DIMENSIONS,
    type: 'api',
    async embed(texts: string[]): Promise<Float32Array[]> {
      return fetchOpenAIEmbeddings(texts, apiKey, baseUrl, model ?? OPENAI_EMBEDDING_MODEL);
    },
  };
}

// --- Ollama Embedding Provider ---

interface OllamaEmbeddingResponse {
  embedding: number[];
}

/** Batch Ollama embed API response: { model, embeddings: [[...], [...]] } */
interface OllamaBatchEmbedResponse {
  model: string;
  embeddings: number[][];
}

const OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text';
const OLLAMA_DIMENSIONS = 768;

async function fetchOllamaEmbedding(text: string, baseUrl: string, model: string): Promise<Float32Array> {
  const response = await fetchWithTimeout(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
  }, OLLAMA_TIMEOUT);

  if (!response.ok) {
    throw new Error(`Ollama embedding error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OllamaEmbeddingResponse;
  return new Float32Array(data.embedding);
}

/**
 * Batch embedding via Ollama's /api/embed (supports multiple inputs in one request).
 * Falls back to parallel individual /api/embeddings calls if batch endpoint is unavailable.
 */
async function fetchOllamaEmbeddingsBatch(texts: string[], baseUrl: string, model: string): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) {
    return [await fetchOllamaEmbedding(texts[0], baseUrl, model)];
  }

  // Try batch API first (/api/embed with "input" array)
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: texts }),
    }, OLLAMA_TIMEOUT);

    if (response.ok) {
      const data = (await response.json()) as OllamaBatchEmbedResponse;
      if (data.embeddings && data.embeddings.length === texts.length) {
        return data.embeddings.map((e) => new Float32Array(e));
      }
    }
  } catch {
    // Batch API unavailable, fall through to parallel fallback
  }

  // Fallback: process texts in parallel (not serial) for individual calls
  const promises = texts.map((text) => fetchOllamaEmbedding(text, baseUrl, model));
  return Promise.all(promises);
}

function createOllamaEmbeddingService(baseUrl: string): EmbeddingService {
  return {
    dimensions: OLLAMA_DIMENSIONS,
    type: 'api',
    async embed(texts: string[]): Promise<Float32Array[]> {
      return fetchOllamaEmbeddingsBatch(texts, baseUrl, OLLAMA_EMBEDDING_MODEL);
    },
  };
}

// --- TF-IDF Fallback (no API required) ---

const TFIDF_DIMENSIONS = 1536;

/**
 * Simple TF-IDF vectorizer that produces fixed-dimension vectors.
 * Uses hashing trick to map tokens to fixed-size buckets.
 */
class TfIdfVectorizer {
  private documentFrequency = new Map<number, number>();
  private totalDocuments = 0;

  /** Hash a token to a bucket index */
  private hashToken(token: string): number {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % TFIDF_DIMENSIONS;
  }

  /** Tokenize text into normalized tokens */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && t.length < 50);
  }

  /** Update document frequency counts from training data */
  train(documents: string[]): void {
    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        const bucket = this.hashToken(token);
        this.documentFrequency.set(bucket, (this.documentFrequency.get(bucket) || 0) + 1);
      }
      this.totalDocuments++;
    }
  }

  /** Vectorize a single text into a Float32Array */
  vectorize(text: string): Float32Array {
    const vec = new Float32Array(TFIDF_DIMENSIONS);
    const tokens = this.tokenize(text);

    // Term frequency
    const tf = new Map<number, number>();
    for (const token of tokens) {
      const bucket = this.hashToken(token);
      tf.set(bucket, (tf.get(bucket) || 0) + 1);
    }

    // TF-IDF
    const numTokens = tokens.length || 1;
    for (const [bucket, count] of tf) {
      const termFreq = count / numTokens;
      const docFreq = this.documentFrequency.get(bucket) || 1;
      const idf = Math.log((this.totalDocuments + 1) / (docFreq + 1)) + 1;
      vec[bucket] = termFreq * idf;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;

    return vec;
  }
}

function createTfIdfEmbeddingService(): EmbeddingService {
  const vectorizer = new TfIdfVectorizer();

  return {
    dimensions: TFIDF_DIMENSIONS,
    type: 'tfidf',
    async embed(texts: string[]): Promise<Float32Array[]> {
      // Train on the batch first for IDF calculation
      vectorizer.train(texts);
      return texts.map(t => vectorizer.vectorize(t));
    },
  };
}

// --- Quick probe: validate an API embedding service is actually usable ---

/**
 * Probe an embedding service by sending a single short text.
 * Uses a short timeout to avoid hanging.
 * Returns true if the service responds correctly within PROBE_TIMEOUT.
 */
async function probeEmbeddingService(service: EmbeddingService): Promise<boolean> {
  try {
    const result = await service.embed(['test']);
    return result.length === 1 && result[0].length > 0;
  } catch (err) {
    console.warn(`[Embedding] Probe failed for ${service.type} service:`, err instanceof Error ? err.message : String(err));
    return false;
  }
}

// --- Provider detection & factory ---

/** Base URLs for known providers that support /embeddings */
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  baidu: 'https://qianfan.baidubce.com/v2',
  kimi: 'https://api.moonshot.cn/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  minimax: 'https://api.minimax.chat/v1',
  jinmo: 'https://api.zhejiangjinmo.com/v1',
  qwen35b: 'https://qwen3635bq4.zhejiangjinmo.com/v1',
};

/** Provider-specific embedding model names for non-OpenAI providers */
const PROVIDER_EMBEDDING_MODELS: Record<string, string> = {
  openai: 'text-embedding-3-small',
  deepseek: 'text-embedding-v2',
  baidu: 'Embedding-V1',
  qwen: 'text-embedding-v2',
  kimi: 'text-embedding-v2',
  glm: 'embedding-2',
  minimax: 'embo-01',
  doubao: 'doubao-embedding-v1',
  jinmo: 'text-embedding-v2',
  qwen35b: 'text-embedding-v2',
};


/**
 * Create an embedding service based on the current application config.
 * Priority:
 *  1. OpenAI key → OpenAI embedding API (probed)
 *  2. Other OpenAI-compatible key → that provider's embedding API (probed)
 *  3. Custom provider with baseUrl → custom embedding API (probed)
 *  4. Ollama (if reachable) → Ollama embedding API (probed)
 *  5. None → TF-IDF fallback (instant, no network calls)
 *
 * Each API-based provider is quickly probed (5s timeout) before being selected.
 * If the probe fails, the next provider in priority is tried.
 * This prevents the pipeline from hanging when a configured API is not accessible.
 */
export async function createEmbeddingService(config: AppConfig): Promise<EmbeddingService> {
  // Check for API key-based providers
  const providerOrder = ['openai', 'deepseek', 'qwen', 'glm', 'kimi', 'baidu', 'doubao', 'minimax', 'jinmo', 'qwen35b'] as const;

  for (const name of providerOrder) {
    const key = config.apiKeys[name as keyof typeof config.apiKeys];
    if (key) {
      const baseUrl = PROVIDER_BASE_URLS[name];
      if (baseUrl) {
        const model = PROVIDER_EMBEDDING_MODELS[name] ?? OPENAI_EMBEDDING_MODEL;
        const service = createOpenAIEmbeddingService(key, baseUrl, model);
        console.log(`[Embedding] Probing ${name} embedding API at ${baseUrl}...`);
        const ok = await probeEmbeddingService(service);
        if (ok) {
          console.log(`[Embedding] ${name} embedding API probe OK, using API provider`);
          return service;
        }
        console.warn(`[Embedding] ${name} embedding API probe FAILED, trying next provider`);
      }
    }
  }

  // Custom provider (probed)
  if (config.custom.apiKey && config.custom.baseUrl) {
    const service = createOpenAIEmbeddingService(config.custom.apiKey, config.custom.baseUrl);
    const ok = await probeEmbeddingService(service);
    if (ok) {
      console.log(`[Embedding] Custom provider probe OK, using API provider`);
      return service;
    }
    console.warn('[Embedding] Custom provider probe FAILED');
  }

  // Ollama — only if actually reachable (quick 2s health check)
  if (config.ollama.baseUrl) {
    try {
      const resp = await fetch(`${config.ollama.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        const service = createOllamaEmbeddingService(config.ollama.baseUrl);
        const ok = await probeEmbeddingService(service);
        if (ok) {
          console.log(`[Embedding] Ollama probe OK, using Ollama provider`);
          return service;
        }
        console.warn('[Embedding] Ollama probe FAILED');
      }
    } catch {
      // Ollama not reachable — fall through to TF-IDF
    }
  }

  // TF-IDF fallback (instant, fully local)
  console.log('[Embedding] Using TF-IDF fallback (no API provider available)');
  return createTfIdfEmbeddingService();
}
