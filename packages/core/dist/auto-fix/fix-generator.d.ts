import type { DiagnosticInfo, FixSuggestion } from './types.js';
export declare class FixGenerator {
    generateFix(diagnostic: DiagnosticInfo, codeContext: string): FixSuggestion;
    generateBatchFixes(diagnostics: DiagnosticInfo[]): FixSuggestion[];
    private describeFix;
    private estimateConfidence;
}
//# sourceMappingURL=fix-generator.d.ts.map