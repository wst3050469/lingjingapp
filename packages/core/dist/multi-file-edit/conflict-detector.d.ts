import type { FileDiff } from './types.js';
export declare class ConflictDetector {
    detectConflicts(diffs: FileDiff[], baseHashes: Map<string, string>): FileDiff[];
    private computeFileHash;
}
//# sourceMappingURL=conflict-detector.d.ts.map