import type { Checkpoint, CheckpointConfig } from './types.js';
export declare class CheckpointCleaner {
    private config;
    constructor(config?: Partial<CheckpointConfig>);
    clean(checkpoints: Checkpoint[]): Promise<string[]>;
}
//# sourceMappingURL=checkpoint-cleaner.d.ts.map