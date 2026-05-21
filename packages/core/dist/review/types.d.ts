export type ReviewDimension = 'security' | 'performance' | 'style' | 'best-practice' | 'logic-error';
export type ReviewSeverity = 'critical' | 'warning' | 'info' | 'suggestion';
export interface ReviewRule {
    id: string;
    name: string;
    dimension: ReviewDimension;
    severity: ReviewSeverity;
    pattern: string;
    patternType: 'regex' | 'ast';
    message: string;
    suggestion?: string;
    languages: string[];
    enabled?: boolean;
    builtin?: boolean;
}
export interface ReviewFinding {
    ruleId: string;
    ruleName: string;
    dimension: ReviewDimension;
    severity: ReviewSeverity;
    filePath: string;
    line: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    message: string;
    suggestion?: string;
    codeSnippet?: string;
}
export interface ReviewReport {
    id: string;
    prId?: string;
    branch?: string;
    commitSha?: string;
    findings: ReviewFinding[];
    summary: ReviewSummary;
    reviewedAt: string;
    reviewerType: 'rule' | 'llm' | 'hybrid';
}
export interface ReviewSummary {
    total: number;
    byDimension: Record<ReviewDimension, number>;
    bySeverity: Record<ReviewSeverity, number>;
    score: number;
}
//# sourceMappingURL=types.d.ts.map