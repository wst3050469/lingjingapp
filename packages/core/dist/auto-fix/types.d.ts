export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';
export type FixStatus = 'suggested' | 'applied' | 'rejected' | 'failed' | 'rolled-back';
export interface DiagnosticInfo {
    filePath: string;
    line: number;
    column: number;
    severity: DiagnosticSeverity;
    code: string;
    message: string;
    source: string;
}
export interface FixSuggestion {
    id: string;
    diagnostic: DiagnosticInfo;
    fixDescription: string;
    fixDiff: string;
    status: FixStatus;
    confidence: number;
}
export interface FixResult {
    success: boolean;
    fixId: string;
    appliedAt: Date;
    newDiagnostics?: DiagnosticInfo[];
    error?: string;
}
export interface BatchFixGroup {
    type: string;
    diagnostics: DiagnosticInfo[];
    suggestion?: FixSuggestion;
}
//# sourceMappingURL=types.d.ts.map