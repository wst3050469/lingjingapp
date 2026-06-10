export class PartialAcceptor {
    remainingWords = [];
    originalText = '';
    setSuggestion(text) {
        this.originalText = text;
        this.remainingWords = this.splitIntoWords(text);
    }
    acceptAll() {
        const text = this.originalText;
        this.clear();
        return text;
    }
    acceptNextWord() {
        if (this.remainingWords.length === 0) {
            return null;
        }
        const word = this.remainingWords.shift();
        const remaining = this.remainingWords.join('');
        return { word, remaining, isLast: this.remainingWords.length === 0 };
    }
    reject() {
        this.clear();
    }
    getRemainingText() {
        return this.remainingWords.join('');
    }
    hasPartial() {
        return this.remainingWords.length > 0;
    }
    splitIntoWords(text) {
        const words = [];
        let i = 0;
        while (i < text.length) {
            if (/\s/.test(text[i])) {
                let j = i;
                while (j < text.length && /\s/.test(text[j]))
                    j++;
                words.push(text.slice(i, j));
                i = j;
            }
            else if (/[a-zA-Z0-9_]/.test(text[i])) {
                let j = i;
                while (j < text.length && /[a-zA-Z0-9_]/.test(text[j]))
                    j++;
                words.push(text.slice(i, j));
                i = j;
            }
            else {
                words.push(text[i]);
                i++;
            }
        }
        return words;
    }
    clear() {
        this.remainingWords = [];
        this.originalText = '';
    }
}
//# sourceMappingURL=partial-acceptor.js.map