export declare class CheckpointManager {
    createSnapshot(): void;
    list(): never[];
    get(_id: string): null;
    delete(_id: string): void;
}
export declare class FileCheckpointStorage {
}
export declare function createCheckpointManager(): CheckpointManager;
export interface Checkpoint {
    id: string;
    timestamp: number;
}
export declare class SnapshotCreator {
    createSnapshot(_id: string, _data: any): {};
}
export declare class RollbackExecutor {
    rollback(_id: string): void;
}
export declare class CheckpointCleaner {
}
//# sourceMappingURL=index.d.ts.map