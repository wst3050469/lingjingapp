// Checkpoint types — minimal stub for type checking

export class CheckpointManager {
  createSnapshot() { throw new Error('Not implemented'); }
  list() { return []; }
  get(_id: string) { return null; }
  delete(_id: string) {}
}

export class FileCheckpointStorage {}

export function createCheckpointManager(): CheckpointManager {
  return new CheckpointManager();
}

export interface Checkpoint {
  id: string;
  timestamp: number;
}

export class SnapshotCreator {
  createSnapshot(_id: string, _data: any) { return {}; }
}

export class RollbackExecutor {
  rollback(_id: string): void {}
}

export class CheckpointCleaner {}
