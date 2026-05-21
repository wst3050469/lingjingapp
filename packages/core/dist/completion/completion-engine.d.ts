import type { CompletionResult, CompletionConfig, CompletionSession, RelatedSnippet } from './types.js';
import type { IntentDetector } from '../intent/intent-detector.js';
export declare class CompletionEngine {
    private debounceTrigger;
    private contextBuilder;
    private suggestionFilter;
    private partialAcceptor;
    private cancellationController;
    private config;
    private currentSession;
    private intentDetector?;
    constructor(config?: Partial<CompletionConfig>, intentDetector?: IntentDetector);
    trigger(params: {
        prefix: string;
        suffix: string;
        filePath: string;
        languageId: string;
        imports: string[];
        relatedSnippets: RelatedSnippet[];
    }): void;
    cancel(): void;
    accept(): string | null;
    acceptWord(): {
        word: string;
        remaining: string;
        isLast: boolean;
    } | null;
    reject(): void;
    getSession(): CompletionSession | null;
    private executeCompletion;
    setSuggestion(result: CompletionResult, suffixText: string): CompletionResult | null;
}
//# sourceMappingURL=completion-engine.d.ts.map