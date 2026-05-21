export class ContextBuilder {
    maxPrefixChars;
    maxSuffixChars;
    constructor(maxPrefixChars = 20000, maxSuffixChars = 10000) {
        this.maxPrefixChars = maxPrefixChars;
        this.maxSuffixChars = maxSuffixChars;
    }
    build(params) {
        return {
            prefix: params.prefix.slice(-this.maxPrefixChars),
            suffix: params.suffix.slice(0, this.maxSuffixChars),
            filePath: params.filePath,
            languageId: params.languageId,
            imports: params.imports.slice(0, 100),
            relatedSnippets: params.relatedSnippets,
            maxTokens: params.maxTokens,
        };
    }
}
//# sourceMappingURL=context-builder.js.map