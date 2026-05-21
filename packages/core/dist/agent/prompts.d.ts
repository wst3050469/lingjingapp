declare global {
    var __CODEPILOT_MAIN_PROMPT: string | undefined;
    var __CODEPILOT_REVIEWER_PROMPT: string | undefined;
    var __CODEPILOT_EXPLORER_PROMPT: string | undefined;
    var __CODEPILOT_PROMPTS: Record<string, string> | undefined;
}
export declare let MAIN_PROMPT: string;
export declare let CODE_REVIEWER_PROMPT: string;
export declare let EXPLORER_PROMPT: string;
/**
 * Load prompts. Priority:
 * 1. globalThis injected values (bundled/pkg mode)
 * 2. File system (dev mode - scan all .md files)
 * 3. Hardcoded fallbacks
 */
export declare function loadPrompts(): Promise<void>;
export declare function getPrompt(name: string): string;
//# sourceMappingURL=prompts.d.ts.map