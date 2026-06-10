import type { LLMProvider } from '../adapters/types.js';
export declare class NLToCronConverter {
    convert(naturalLanguage: string, llmProvider?: LLMProvider): Promise<{
        cron: string;
        error?: string;
    }>;
    private tryLLMConversion;
    private ruleBasedConvert;
    validateCron(cron: string): boolean;
    private validateField;
}
//# sourceMappingURL=nl-to-cron-converter.d.ts.map