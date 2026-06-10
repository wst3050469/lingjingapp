import type { ContextSnapshot, PersistResult, SessionMetadata, RestoredContext, RestoreStrategy, RestoreOptions, ReflectorResultSnapshot } from './types.js';
import type { StorageBackend } from './storage-backend.js';
import type { Conversation } from '../agent/conversation.js';
import { SchemaVersionManager } from './schema-version-manager.js';
import { MigrationPipeline } from './migration-pipeline.js';
import { StorageGC } from './storage-gc.js';
import type { CrossSessionConfig } from './config.js';
export declare class CrossSessionMemory {
    private persistor;
    private restorer;
    private snapshotter;
    private versionManager;
    private migrationPipeline;
    private nudgerAdapter;
    private reflectorAdapter;
    private shutdownHook;
    private gc;
    private sanitizer;
    constructor(backend: StorageBackend, config?: Partial<CrossSessionConfig>, deps?: {
        nudger?: {
            review: (conversation: Conversation) => unknown;
        };
        reflector?: {
            reflect: (memories: unknown[]) => unknown;
        };
        shutdown?: import('../lifecycle/graceful-shutdown.js').GracefulShutdown;
    });
    save(snapshot: ContextSnapshot): Promise<PersistResult>;
    restore(sessionId: string, strategy?: RestoreStrategy, options?: RestoreOptions): Promise<RestoredContext>;
    autoRestore(): Promise<RestoredContext | null>;
    listSessions(): Promise<SessionMetadata[]>;
    deleteSession(sessionId: string): Promise<void>;
    onNudge(conversation: Conversation, baseSnapshot: ContextSnapshot | null): void;
    onReflect(memories: unknown[]): void;
    consumeReflectorResult(): ReflectorResultSnapshot | null;
    getVersionManager(): SchemaVersionManager;
    getMigrationPipeline(): MigrationPipeline;
    getGC(): StorageGC;
}
//# sourceMappingURL=cross-session-memory.d.ts.map