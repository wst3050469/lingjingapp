export class TokenCalculator {
    charsPerToken;
    constructor(charsPerToken = 4) {
        this.charsPerToken = charsPerToken;
    }
    estimateTokens(text) {
        return Math.ceil(text.length / this.charsPerToken);
    }
    calculateTotalTokens(contents) {
        return contents.reduce((sum, content) => sum + this.estimateTokens(content), 0);
    }
}
//# sourceMappingURL=token-calculator.js.map