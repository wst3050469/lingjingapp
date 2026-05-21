import type { CompletionRequest, RelatedSnippet } from './types.js';
export declare class ContextBuilder {
    private readonly maxPrefixChars;
    private readonly maxSuffixChars;
    constructor(maxPrefixChars?: number, maxSuffixChars?: number);
    build(params: {
        prefix: string;
        suffix: string;
        filePath: string;
        languageId: string;
        imports: string[];
        relatedSnippets: RelatedSnippet[];
        maxTokens: number;
    }): CompletionRequest;
}
//# sourceMappingURL=context-builder.d.ts.map