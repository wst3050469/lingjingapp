import type { HooksManager } from '../hooks/index.js';
export interface Checkpoint {
    id: string;
    timestamp: Date;
    description: string;
    files: CheckpointFile[];
    metadata?: Record<string, unknown>;
}
export interface CheckpointFile {
    path: string;
    content: string;
    hash: string;
    size: number;
}
export interface CheckpointStorage {
    save(checkpoint: Checkpoint): Promise<void>;
    load(id: string): Promise<Checkpoint | null>;
    list(): Promise<Checkpoint[]>;
    delete(id: string): Promise<boolean>;
}
export declare class FileCheckpointStorage implements CheckpointStorage {
    private storageDir;
    constructor(storageDir: string);
    save(checkpoint: Checkpoint): Promise<void>;
    load(id: string): Promise<Checkpoint | null>;
    list(): Promise<Checkpoint[]>;
    delete(id: string): Promise<boolean>;
}
export declare class CheckpointManager {
    private storage;
    private hooksManager?;
    constructor(storage: CheckpointStorage, hooksManager?: HooksManager);
    create(files: string[], description: string, metadata?: Record<string, unknown>): Promise<Checkpoint>;
    restore(id: string): Promise<{
        success: boolean;
        message: string;
        restoredFiles: string[];
    }>;
    list(): Promise<Checkpoint[]>;
    delete(id: string): Promise<boolean>;
    get(id: string): Promise<Checkpoint | null>;
    private generateId;
    private hashContent;
    createBeforeEdit(filePath: string, description?: string): Promise<Checkpoint>;
    getHistory(limit?: number): Promise<Checkpoint[]>;
    timeTravel(id: string): Promise<{
        success: boolean;
        message: string;
        restoredFiles: string[];
    }>;
}
export declare function createCheckpointManager(storageDir: string, hooksManager?: HooksManager): CheckpointManager;
//# sourceMappingURL=manager.d.ts.map