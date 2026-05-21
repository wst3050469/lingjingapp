import { ReviewRuleLoader } from './rule-loader.js';
import type { LLMProvider } from '../llm/types.js';
import type { ReviewReport, ReviewFinding } from './types.js';
export declare class ReviewEngine {
    private ruleLoader;
    private llmProvider?;
    constructor(llmProvider?: LLMProvider);
    review(diffContent: string, filePath: string, language: string, projectPath: string): Promise<ReviewReport>;
    reviewWithLLM(diffContent: string, filePath: string, language: string): Promise<ReviewFinding[]>;
    reviewLargeDiff(files: Array<{
        diff: string;
        path: string;
        language: string;
    }>, projectPath: string): Promise<ReviewReport>;
    getRuleLoader(): ReviewRuleLoader;
    private deduplicateFindings;
    private buildSummary;
}
//# sourceMappingURL=engine.d.ts.map