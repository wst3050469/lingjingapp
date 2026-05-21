import type { FileDiff, FileEdit } from './types.js';
export declare class DiffGenerator {
    generate(edit: FileEdit): FileDiff;
    private computeHunks;
    private buildHunkContent;
    private longestCommonSubsequence;
}
//# sourceMappingURL=diff-generator.d.ts.map