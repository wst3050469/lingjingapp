import type { ScriptLanguage, SecurityReviewResult, SceneContext, ScriptTemplate } from './types.js';
export interface GenerationResult {
    script: string;
    language: ScriptLanguage;
    source: 'template' | 'llm';
    reviewResult: SecurityReviewResult;
    confidence: number;
    error?: string;
    suggestions?: string[];
}
export interface LLMClient {
    generate(prompt: string, systemPrompt: string): Promise<string>;
}
export interface TemplateParamExtractor {
    (input: string, template: ScriptTemplate): Record<string, string | number>;
}
export declare class OpenSpaceScriptGenerator {
    private llmClient;
    private paramExtractor;
    private generationHistory;
    private readonly maxHistory;
    constructor(llmClient?: LLMClient, paramExtractor?: TemplateParamExtractor);
    generate(naturalLanguage: string, sceneContext?: SceneContext): Promise<GenerationResult>;
    private generateFromTemplate;
    private generateFromLLM;
    private buildUserPrompt;
    private sanitizeLLMOutput;
    private addToHistory;
    getHistory(): ReadonlyArray<{
        input: string;
        result: GenerationResult;
        timestamp: number;
    }>;
    clearHistory(): void;
}
//# sourceMappingURL=script-generator.d.ts.map