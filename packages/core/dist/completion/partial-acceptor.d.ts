export declare class PartialAcceptor {
    private remainingWords;
    private originalText;
    setSuggestion(text: string): void;
    acceptAll(): string;
    acceptNextWord(): {
        word: string;
        remaining: string;
        isLast: boolean;
    } | null;
    reject(): void;
    getRemainingText(): string;
    hasPartial(): boolean;
    private splitIntoWords;
    private clear;
}
//# sourceMappingURL=partial-acceptor.d.ts.map