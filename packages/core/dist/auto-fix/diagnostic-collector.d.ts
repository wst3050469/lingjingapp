import type { DiagnosticInfo, DiagnosticSeverity } from './types.js';
export declare class DiagnosticCollector {
    private diagnostics;
    add(diagnostic: DiagnosticInfo): void;
    addAll(diagnostics: DiagnosticInfo[]): void;
    getByFile(filePath: string): DiagnosticInfo[];
    getBySeverity(severity: DiagnosticSeverity): DiagnosticInfo[];
    groupByType(): Map<string, DiagnosticInfo[]>;
    getAll(): DiagnosticInfo[];
    clear(): void;
}
//# sourceMappingURL=diagnostic-collector.d.ts.map