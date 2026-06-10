// File pattern matching utility
/**
 * Simple glob-like pattern matching for file paths
 * Supports: *, **, ?
 */
function simpleGlobMatch(filePath, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/\*\*/g, '___DOUBLE_STAR___')
        .replace(/\*/g, '[^/]*')
        .replace(/___DOUBLE_STAR___/g, '.*')
        .replace(/\?/g, '[^/]');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
}
/**
 * Check if a file path matches any of the given patterns
 * @param filePath - The file path to check
 * @param patterns - Comma-separated glob patterns
 * @returns true if the file matches any pattern
 */
export function matchesPatterns(filePath, patterns) {
    const patternList = patterns.split(',').map(p => p.trim()).filter(Boolean);
    for (const pattern of patternList) {
        try {
            if (simpleGlobMatch(filePath, pattern)) {
                return true;
            }
        }
        catch (error) {
            // If pattern is invalid, skip it
            console.warn(`Invalid pattern: ${pattern}`, error);
        }
    }
    return false;
}
/**
 * Check if a file matches any rule in a list of filePattern rules
 * @param filePath - The file path to check
 * @param patterns - Array of pattern strings
 * @returns true if the file matches any pattern
 */
export function matchesAnyPattern(filePath, patterns) {
    return patterns.some(pattern => matchesPatterns(filePath, pattern));
}
//# sourceMappingURL=pattern-matcher.js.map