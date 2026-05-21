import type { Checkpoint, RollbackStrategy, RollbackResult } from './types.js';
export declare class RollbackExecutor {
    rollback(checkpoint: Checkpoint, strategy?: RollbackStrategy): Promise<RollbackResult>;
}
//# sourceMappingURL=rollback-executor.d.ts.map