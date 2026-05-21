import type { ContextSnapshot, RestoreStrategy, RestoreOptions, RestoredContext, ResolvedSnapshot } from './types.js';
import type { StorageBackend } from './storage-backend.js';
import { SchemaVersionManager } from './schema-version-manager.js';
import { ContextCompressor } from '../agent/context-compressor.js';
export declare class ContextRestorer {
    private backend;
    private versionManager;
    private compressor;
    constructor(config: {
        backend: StorageBackend;
        versionManager: SchemaVersionManager;
        compressor?: ContextCompressor;
    });
    restore(sessionId: string, strategy?: RestoreStrategy, options?: RestoreOptions): Promise<RestoredContext>;
    autoRestore(): Promise<RestoredContext | null>;
    resolveRefs(snapshot: ContextSnapshot): Promise<ResolvedSnapshot>;
    private extractMessages;
}
//# sourceMappingURL=context-restorer.d.ts.map