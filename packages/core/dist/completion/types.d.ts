export interface CompletionRequest {
    prefix: string;
    suffix: string;
    filePath: string;
    languageId: string;
    imports: string[];
    relatedSnippets: RelatedSnippet[];
    maxTokens: number;
}
export interface RelatedSnippet {
    content: string;
    filePath: string;
    priority: number;
}
export interface CompletionResult {
    text: string;
    replaceRange?: {
        startLine: number;
        startCol: number;
        endLine: number;
        endCol: number;
    };
    confidence: number;
    isMultiLine: boolean;
}
export interface CompletionConfig {
    debounceMs: number;
    maxPrefixChars: number;
    maxSuffixChars: number;
    timeoutMs: number;
    enableMultiLine: boolean;
    maxTokens: number;
}
export type CompletionSessionState = 'idle' | 'requesting' | 'streaming' | 'completed' | 'cancelled' | 'error';
export interface CompletionSession {
    id: string;
    state: CompletionSessionState;
    request: CompletionRequest;
    result?: CompletionResult;
    createdAt: Date;
    completedAt?: Date;
}
export type CompletionStreamEvent = {
    type: 'text_delta';
    text: string;
} | {
    type: 'done';
    result: CompletionResult;
} | {
    type: 'error';
    error: string;
};
//# sourceMappingURL=types.d.ts.map