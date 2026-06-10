import type { DiagnosticInfo, FixSuggestion, FixResult, BatchFixGroup } from './types.js';
export declare class AutoFixEngine {
    private diagnosticCollector;
    private fixGenerator;
    private batchFixer;
    private fixValidator;
    constructor();
    suggest(diagnostic: DiagnosticInfo, codeContext: string): FixSuggestion;
    batchSuggest(diagnostics: DiagnosticInfo[]): BatchFixGroup[];
    validate(fixId: string, newDiagnostics: DiagnosticInfo[], previousDiagnostics: DiagnosticInfo[]): FixResult;
    addDiagnostics(diagnostics: DiagnosticInfo[]): void;
    getDiagnosticsByFile(filePath: string): DiagnosticInfo[];
}
//# sourceMappingURL=auto-fix-engine.d.ts.map