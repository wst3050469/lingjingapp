import type { TerminalSuggestion } from './types.js';
export declare class TerminalSuggester {
    private commandAnalyzer;
    private riskClassifier;
    constructor();
    analyze(intent: string, projectRoot: string): TerminalSuggestion[];
}
//# sourceMappingURL=terminal-suggester.d.ts.map