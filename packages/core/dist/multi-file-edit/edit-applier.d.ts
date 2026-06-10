import type { FileDiff, ApplyResult } from './types.js';
export declare class EditApplier {
    applyFile(diff: FileDiff, originalContent: string): ApplyResult;
    applyAll(diffs: FileDiff[], contents: Map<string, string>): ApplyResult[];
}
//# sourceMappingURL=edit-applier.d.ts.map