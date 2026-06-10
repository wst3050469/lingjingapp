import { Tool } from '../types.js';
export interface CodeReviewIssue {
    severity: 'critical' | 'major' | 'minor' | 'info';
    category: 'security' | 'performance' | 'correctness' | 'style' | 'best_practices';
    title: string;
    file: string;
    line?: number;
    code_snippet?: string;
    description: string;
    suggestion: string;
}
export interface CodeReviewReport {
    summary: string;
    score?: number;
    total_issues: number;
    severity_counts: {
        critical: number;
        major: number;
        minor: number;
        info: number;
    };
    issues: CodeReviewIssue[];
    positives: string[];
    scope: string;
}
export declare function initCodeReviewTool(subAgentExecute: (agentType: string, task: string, signal?: AbortSignal) => Promise<string>): void;
export declare function parseStructuredReport(text: string): CodeReviewReport;
export declare const codeReviewTool: Tool;
//# sourceMappingURL=code-review.d.ts.map