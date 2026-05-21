/**
 * Check if a file path matches any of the given patterns
 * @param filePath - The file path to check
 * @param patterns - Comma-separated glob patterns
 * @returns true if the file matches any pattern
 */
export declare function matchesPatterns(filePath: string, patterns: string): boolean;
/**
 * Check if a file matches any rule in a list of filePattern rules
 * @param filePath - The file path to check
 * @param patterns - Array of pattern strings
 * @returns true if the file matches any pattern
 */
export declare function matchesAnyPattern(filePath: string, patterns: string[]): boolean;
//# sourceMappingURL=pattern-matcher.d.ts.map