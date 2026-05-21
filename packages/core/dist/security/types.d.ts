export type VulnerabilityType = 'xss' | 'sql-injection' | 'hardcoded-secret' | 'path-traversal' | 'command-injection' | 'insecure-deserialization' | 'csrf' | 'insecure-random';
export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ScanScope = 'full' | 'incremental' | 'specified';
export type ScanLanguage = 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust';
export interface SecurityRule {
    id: string;
    name: string;
    vulnerabilityType: VulnerabilityType;
    pattern: string;
    patternType: 'regex' | 'ast';
    severity: ScanSeverity;
    languages: ScanLanguage[];
    message: string;
    suggestion?: string;
    enabled?: boolean;
    builtin?: boolean;
}
export interface Vulnerability {
    ruleId: string;
    ruleName: string;
    vulnerabilityType: VulnerabilityType;
    severity: ScanSeverity;
    filePath: string;
    line: number;
    column?: number;
    endLine?: number;
    message: string;
    suggestion?: string;
    codeSnippet?: string;
}
export interface ScanResult {
    id: string;
    scope: ScanScope;
    targetFiles?: string[];
    vulnerabilities: Vulnerability[];
    summary: ScanSummary;
    durationMs: number;
    scannedAt: string;
    projectPath: string;
}
export interface ScanSummary {
    total: number;
    bySeverity: Record<ScanSeverity, number>;
    byType: Record<VulnerabilityType, number>;
}
export interface FixSuggestion {
    vulnerability: Vulnerability;
    fixDiff?: string;
    fixDescription?: string;
    autoApplicable: boolean;
}
//# sourceMappingURL=types.d.ts.map