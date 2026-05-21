import type { ContextSnapshot, IncrementalSnapshot, PersistResult } from './types.js';
import type { StorageBackend } from './storage-backend.js';
import type { Conversation } from '../agent/conversation.js';
export declare class IncrementalSnapshotter {
    private lastFullSnapshotId;
    computeDelta(conversation: Conversation, baseSnapshot: ContextSnapshot | null): IncrementalSnapshot | null;
    saveIncremental(incremental: IncrementalSnapshot, backend: StorageBackend): Promise<PersistResult>;
    setBaseSnapshot(snapshotId: string): void;
    getBaseSnapshotId(): string | null;
}
//# sourceMappingURL=incremental-snapshotter.d.ts.map