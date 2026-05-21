import type { DiagnosticInfo, FixSuggestion, BatchFixGroup } from './types.js';
export declare class BatchFixer {
    groupByType(diagnostics: DiagnosticInfo[]): BatchFixGroup[];
    applyBatchFix(group: BatchFixGroup, suggestion: FixSuggestion): FixSuggestion[];
}
//# sourceMappingURL=batch-fixer.d.ts.map