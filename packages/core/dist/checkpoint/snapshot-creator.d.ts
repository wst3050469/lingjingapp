import type { Checkpoint } from './types.js';
export declare class SnapshotCreator {
    private storageDir;
    constructor(storageDir: string);
    createSnapshot(files: string[], description: string): Promise<Checkpoint>;
    createBeforeEditSnapshot(filePath: string): Promise<Checkpoint>;
}
//# sourceMappingURL=snapshot-creator.d.ts.map