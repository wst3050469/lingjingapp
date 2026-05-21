export class SuggestionFilter {
    filter(result, suffixText) {
        if (!result.text || result.text.trim().length === 0) {
            return null;
        }
        if (suffixText.startsWith(result.text)) {
            return null;
        }
        if (result.text === suffixText.slice(0, result.text.length)) {
            return null;
        }
        return result;
    }
}
//# sourceMappingURL=suggestion-filter.js.map