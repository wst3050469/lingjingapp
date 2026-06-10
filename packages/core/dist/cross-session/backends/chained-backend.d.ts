import type { StorageBackend } from '../storage-backend.js';
export declare class ChainedStorageBackend implements StorageBackend {
    readonly type: "memory";
    private backends;
    private activeIndex;
    constructor(backends: StorageBackend[]);
    save(key: string, data: unknown): Promise<void>;
    load(key: string): Promise<unknown | null>;
    delete(key: string): Promise<boolean>;
    list(): Promise<string[]>;
    exists(key: string): Promise<boolean>;
    getActiveBackendType(): string;
    getActiveIndex(): number;
}
//# sourceMappingURL=chained-backend.d.ts.map