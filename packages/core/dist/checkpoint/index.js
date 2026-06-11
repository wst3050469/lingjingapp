// Checkpoint types — minimal stub for type checking
export class CheckpointManager {
    createSnapshot() { throw new Error('Not implemented'); }
    list() { return []; }
    get(_id) { return null; }
    delete(_id) { }
}
export class FileCheckpointStorage {
}
export function createCheckpointManager() {
    return new CheckpointManager();
}
export class SnapshotCreator {
    createSnapshot(_id, _data) { return {}; }
}
export class RollbackExecutor {
    rollback(_id) { }
}
export class CheckpointCleaner {
}
//# sourceMappingURL=index.js.map