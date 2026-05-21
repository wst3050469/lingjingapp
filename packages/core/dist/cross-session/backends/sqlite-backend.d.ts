import type { StorageBackend } from '../storage-backend.js';
import type { StorageBackendType } from '../types.js';
export interface SQLiteDatabase {
    exec(sql: string): void;
    run(sql: string, params?: unknown[]): {
        changes: number;
    };
    get<T = unknown>(sql: string, params?: unknown[]): T | undefined;
    all<T = unknown>(sql: string, params?: unknown[]): T[];
}
export declare class SQLiteStorageBackend implements StorageBackend {
    readonly type: StorageBackendType;
    private db;
    private initialized;
    constructor(db: SQLiteDatabase);
    private init;
    save(key: string, data: unknown): Promise<void>;
    load(key: string): Promise<unknown | null>;
    delete(key: string): Promise<boolean>;
    list(): Promise<string[]>;
    exists(key: string): Promise<boolean>;
}
//# sourceMappingURL=sqlite-backend.d.ts.map