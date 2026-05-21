import type { StorageBackend } from '../storage-backend.js';
import type { StorageBackendType } from '../types.js';
export declare class FileStorageBackend implements StorageBackend {
    readonly type: StorageBackendType;
    private storageDir;
    constructor(storageDir?: string);
    save(key: string, data: unknown): Promise<void>;
    load(key: string): Promise<unknown | null>;
    delete(key: string): Promise<boolean>;
    list(): Promise<string[]>;
    exists(key: string): Promise<boolean>;
    getSize(key: string): Promise<number>;
    private getFilePath;
    private ensureDir;
}
//# sourceMappingURL=file-backend.d.ts.map