import type { RestoreStrategy, StorageBackendType } from './types.js';
export interface CrossSessionConfig {
    storageBackend: StorageBackendType;
    storageDir: string;
    dbPath: string;
    maxStorageMB: number;
    maxQueueDepth: number;
    enableIncrementalSnapshot: boolean;
    enableAutoRestore: boolean;
    defaultRestoreStrategy: RestoreStrategy;
    workingWindowSize: number;
}
export declare const DEFAULT_CROSS_SESSION_CONFIG: CrossSessionConfig;
//# sourceMappingURL=config.d.ts.map