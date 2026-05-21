// Utility helpers
export function truncateString(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - 15) + '...(truncated)';
}
export function truncateLines(str, maxLines) {
    const lines = str.split('\n');
    if (lines.length <= maxLines)
        return str;
    return lines.slice(0, maxLines).join('\n') + `\n...(${lines.length - maxLines} more lines)`;
}
//# sourceMappingURL=truncate.js.map