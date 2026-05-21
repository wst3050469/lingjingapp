import type { Vulnerability, FixSuggestion } from './types.js';
import type { LLMProvider } from '../llm/types.js';
export declare class SecurityFixIntegration {
    private llmProvider?;
    constructor(llmProvider?: LLMProvider);
    generateFix(vulnerability: Vulnerability, projectPath: string): Promise<FixSuggestion>;
    applyFix(vulnerability: Vulnerability, fixDiff: string): Promise<{
        success: boolean;
        newVulnerabilities?: Vulnerability[];
    }>;
}
//# sourceMappingURL=fix-integration.d.ts.map