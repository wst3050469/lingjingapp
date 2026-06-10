import type { LLMProvider } from './types.js';
import type { AppConfig } from '../config/schema.js';
/**
 * OpenAI-compatible providers with their default base URLs.
 * All use the OpenAI chat completions API format.
 * Note: doubao is listed here for UI reference (label, models) but has its own provider.
 */
declare const OPENAI_COMPATIBLE_PROVIDERS: Record<string, {
    baseUrl: string;
    label: string;
    models?: string[];
    note?: string;
}>;
export { OPENAI_COMPATIBLE_PROVIDERS };
/**
 * Get the context window size for a given model string (e.g. "deepseek:deepseek-v4-pro").
 * Returns the model's known context window, or the provided default.
 */
export declare function getModelContextWindow(model: string, defaultSize?: number): number;
export declare function createProvider(config: AppConfig): LLMProvider;
//# sourceMappingURL=provider-factory.d.ts.map