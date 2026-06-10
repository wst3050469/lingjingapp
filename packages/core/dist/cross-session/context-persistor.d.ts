import type { ContextSnapshot, PersistResult, SessionMetadata } from './types.js';
import type { StorageBackend } from './storage-backend.js';
import { SchemaVersionManager } from './schema-version-manager.js';
import { DataSanitizer } from '../security/data-sanitizer.js';
import { ContextCompressor } from '../agent/context-compressor.js';
export declare class ContextPersistor {
    private backend;
    private sanitizer;
    private versionManager;
    private compressor;
    private queue;
    private processing;
    private maxQueueDepth;
    constructor(config: {
        backend: StorageBackend;
        sanitizer?: DataSanitizer;
        versionManager: SchemaVersionManager;
        compressor?: ContextCompressor;
        maxQueueDepth?: number;
    });
    save(snapshot: ContextSnapshot): Promise<PersistResult>;
    load(sessionId: string): Promise<ContextSnapshot | null>;
    list(): Promise<SessionMetadata[]>;
    delete(sessionId: string): Promise<void>;
    private enqueue;
    private processQueue;
}
//# sourceMappingURL=context-persistor.d.ts.map