import type { StorageBackend } from './storage-backend.js';
export declare class StorageGC {
    private backend;
    private maxStorageMB;
    private checkIntervalMs;
    private timer;
    constructor(backend: StorageBackend, maxStorageMB?: number, checkIntervalMs?: number);
    checkAndCleanup(): Promise<number>;
    startAutoCheck(): void;
    stopAutoCheck(): void;
}
//# sourceMappingURL=storage-gc.d.ts.map