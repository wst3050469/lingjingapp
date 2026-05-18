export { VectorMemoryStore } from './vector-memory-store.js';
export { InMemoryVectorAdapter } from './adapters/in-memory-adapter.js';
export { createRememberVectorTool } from './tools/remember-vector.js';
export { createRecallVectorTool } from './tools/recall-vector.js';
export type {
  VectorMemoryConfig,
  VectorSearchResult,
  IVectorStoreAdapter,
  IVectorMemoryStore,
} from './types.js';
export { DEFAULT_VECTOR_MEMORY_CONFIG } from './types.js';
