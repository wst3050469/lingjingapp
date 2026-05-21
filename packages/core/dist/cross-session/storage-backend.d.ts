import type { StorageBackendType } from './types.js';
export interface StorageBackend {
    readonly type: StorageBackendType;
    save(key: string, data: unknown): Promise<void>;
    load(key: string): Promise<unknown | null>;
    delete(key: string): Promise<boolean>;
    list(): Promise<string[]>;
    exists(key: string): Promise<boolean>;
}
//# sourceMappingURL=storage-backend.d.ts.map