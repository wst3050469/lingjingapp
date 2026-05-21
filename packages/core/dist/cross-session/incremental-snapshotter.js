import { computeChecksum, generateIncrementalId } from './utils.js';
export class IncrementalSnapshotter {
    lastFullSnapshotId = null;
    computeDelta(conversation, baseSnapshot) {
        if (!baseSnapshot)
            return null;
        const currentMessages = conversation.messages;
        const baseMessages = [
            ...baseSnapshot.layers.system,
            ...baseSnapshot.layers.history,
            ...baseSnapshot.layers.working,
        ];
        const addedMessages = currentMessages.slice(baseMessages.length);
        const currentToolCount = baseSnapshot.toolCallHistory.length;
        const addedToolCalls = baseSnapshot.toolCallHistory.slice(currentToolCount);
        if (addedMessages.length === 0 && addedToolCalls.length === 0) {
            return null;
        }
        const delta = {
            incrementalId: generateIncrementalId(),
            baseSnapshotId: baseSnapshot.snapshotId,
            deltas: {
                addedMessages: addedMessages.length > 0 ? addedMessages : undefined,
                addedToolCalls: addedToolCalls.length > 0 ? addedToolCalls : undefined,
            },
            createdAt: Date.now(),
            checksum: '',
        };
        delta.checksum = computeChecksum(delta.deltas);
        return delta;
    }
    async saveIncremental(incremental, backend) {
        const start = Date.now();
        try {
            await backend.save(incremental.incrementalId, incremental);
            return {
                success: true,
                snapshotId: incremental.incrementalId,
                sizeBytes: JSON.stringify(incremental).length,
                durationMs: Date.now() - start,
            };
        }
        catch (error) {
            return {
                success: false,
                snapshotId: incremental.incrementalId,
                sizeBytes: 0,
                durationMs: Date.now() - start,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    setBaseSnapshot(snapshotId) {
        this.lastFullSnapshotId = snapshotId;
    }
    getBaseSnapshotId() {
        return this.lastFullSnapshotId;
    }
}
//# sourceMappingURL=incremental-snapshotter.js.map