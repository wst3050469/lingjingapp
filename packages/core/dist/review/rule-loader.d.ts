import type { ReviewRule, ReviewFinding } from './types.js';
export declare class ReviewRuleLoader {
    private rules;
    loadRules(projectPath: string): Promise<ReviewRule[]>;
    private addRule;
    match(diffContent: string, filePath: string, language: string): ReviewFinding[];
    getRules(): ReviewRule[];
}
//# sourceMappingURL=rule-loader.d.ts.map