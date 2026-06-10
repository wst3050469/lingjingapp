import type { StorageBackend } from '../storage-backend.js';
import type { StorageBackendType } from '../types.js';
export declare class MemoryStorageBackend implements StorageBackend {
    readonly type: StorageBackendType;
    private store;
    save(key: string, data: unknown): Promise<void>;
    load(key: string): Promise<unknown | null>;
    delete(key: string): Promise<boolean>;
    list(): Promise<string[]>;
    exists(key: string): Promise<boolean>;
    clear(): void;
    get size(): number;
}
//# sourceMappingURL=memory-backend.d.ts.map