let _llmProvider = null;
export function initCodeOptimizerTool(provider) {
    _llmProvider = provider;
}
export const codeOptimizerTool = {
    name: 'code_optimizer',
    description: 'Analyze code for performance issues, code smells, and optimization opportunities. Provides suggestions and automatic refactoring capabilities.',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'Path to the source file to optimize',
            },
            focus_area: {
                type: 'string',
                enum: ['performance', 'memory', 'readability', 'all'],
                description: 'Focus area for optimization (default: all)',
            },
            auto_fix: {
                type: 'boolean',
                description: 'Automatically apply safe fixes (default: false)',
            },
            detect_smells: {
                type: 'boolean',
                description: 'Detect code smells and anti-patterns (default: true)',
            },
            max_suggestions: {
                type: 'number',
                description: 'Maximum number of suggestions (default: 20)',
            },
        },
        required: ['file_path'],
    },
    async execute(params, context) {
        const filePath = params.file_path;
        const focusArea = params.focus_area || 'all';
        const autoFix = params.auto_fix ?? false;
        const detectSmells = params.detect_smells ?? true;
        const maxSuggestions = params.max_suggestions || 20;
        try {
            const { readFileSync, existsSync, writeFileSync } = await import('fs');
            const { extname } = await import('path');
            if (!existsSync(filePath)) {
                return {
                    content: `Error: File not found: ${filePath}`,
                    isError: true,
                };
            }
            const sourceCode = readFileSync(filePath, 'utf-8');
            const ext = extname(filePath);
            context.onProgress?.(`Analyzing ${filePath}...`);
            const suggestions = analyzeCode(sourceCode, ext, focusArea);
            let codeSmells = [];
            if (detectSmells) {
                context.onProgress?.('Detecting code smells...');
                codeSmells = detectCodeSmells(sourceCode, ext);
            }
            let optimizedCode = sourceCode;
            if (autoFix) {
                context.onProgress?.('Applying safe optimizations...');
                optimizedCode = applyOptimizations(sourceCode, suggestions);
                if (optimizedCode !== sourceCode) {
                    writeFileSync(filePath, optimizedCode, 'utf-8');
                }
            }
            const filteredSuggestions = suggestions.slice(0, maxSuggestions);
            const summary = `✅ Code Optimization Analysis for ${filePath}\n\n` +
                `Focus: ${focusArea}\n` +
                `Issues found: ${filteredSuggestions.length}\n` +
                `Code smells: ${codeSmells.length}\n` +
                `Auto-fix: ${autoFix ? 'Applied' : 'Not applied'}\n\n` +
                `## Optimization Suggestions\n\n` +
                filteredSuggestions.map((s, i) => `${i + 1}. [${s.severity.toUpperCase()}] ${s.type} (line ${s.line})\n` +
                    `   ${s.message}\n` +
                    `   Suggestion: ${s.suggestion}\n`).join('\n') +
                `\n## Code Smells\n\n` +
                codeSmells.slice(0, 10).map((smell, i) => `${i + 1}. ${smell.type} (line ${smell.line})\n` +
                    `   ${smell.description}\n` +
                    `   Refactoring: ${smell.refactoring}\n`).join('\n') +
                (autoFix && optimizedCode !== sourceCode
                    ? '\n\n[OPTIMIZED_CODE]\n' + optimizedCode
                    : '');
            return { content: summary };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: `Failed to optimize code: ${msg}`,
                isError: true,
            };
        }
    },
};
function analyzeCode(code, ext, focusArea) {
    const suggestions = [];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        if (focusArea === 'all' || focusArea === 'performance') {
            if (line.includes('for (') && lines[i + 1]?.includes('for (')) {
                suggestions.push({
                    type: 'performance',
                    severity: 'medium',
                    line: lineNum,
                    message: 'Nested loops detected - consider optimization',
                    suggestion: 'Use map/reduce or consider algorithm optimization',
                });
            }
            if (line.includes('.indexOf(') && line.includes('while')) {
                suggestions.push({
                    type: 'performance',
                    severity: 'low',
                    line: lineNum,
                    message: 'indexOf in loop - consider using Map or Set',
                    suggestion: 'Convert array to Set for O(1) lookup',
                });
            }
            if (line.includes('await') && !line.includes('Promise.all')) {
                const nextLines = lines.slice(i + 1, i + 4);
                if (nextLines.some(l => l.includes('await'))) {
                    suggestions.push({
                        type: 'performance',
                        severity: 'high',
                        line: lineNum,
                        message: 'Sequential awaits - consider Promise.all',
                        suggestion: 'Use Promise.all for parallel execution',
                        code: 'await Promise.all([promise1, promise2])',
                    });
                }
            }
        }
        if (focusArea === 'all' || focusArea === 'memory') {
            if (line.includes('new Array(') && line.includes('push')) {
                suggestions.push({
                    type: 'memory',
                    severity: 'medium',
                    line: lineNum,
                    message: 'Array pre-allocation followed by push',
                    suggestion: 'Initialize with exact size or use push from empty array',
                });
            }
            if (line.includes('JSON.stringify') && lines[i + 1]?.includes('JSON.parse')) {
                suggestions.push({
                    type: 'memory',
                    severity: 'high',
                    line: lineNum,
                    message: 'Deep copy via JSON - performance overhead',
                    suggestion: 'Use structuredClone or lodash.cloneDeep',
                });
            }
        }
        if (focusArea === 'all' || focusArea === 'readability') {
            if (line.length > 120) {
                suggestions.push({
                    type: 'readability',
                    severity: 'low',
                    line: lineNum,
                    message: 'Line too long (>120 characters)',
                    suggestion: 'Break line for better readability',
                });
            }
            if (line.includes('if (') && line.includes('&&') && line.split('&&').length > 3) {
                suggestions.push({
                    type: 'readability',
                    severity: 'medium',
                    line: lineNum,
                    message: 'Complex condition with multiple && operators',
                    suggestion: 'Extract to a named function or use early returns',
                });
            }
        }
        if (focusArea === 'all') {
            if (line.includes('console.log')) {
                suggestions.push({
                    type: 'best_practice',
                    severity: 'low',
                    line: lineNum,
                    message: 'console.log statement in production code',
                    suggestion: 'Use proper logging library or remove',
                });
            }
            if (line.includes('eval(')) {
                suggestions.push({
                    type: 'security',
                    severity: 'high',
                    line: lineNum,
                    message: 'eval() usage - security risk',
                    suggestion: 'Remove eval() and use safer alternatives',
                });
            }
        }
    }
    return suggestions.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
}
function detectCodeSmells(code, ext) {
    const smells = [];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        if (line.trim().length === 0) {
            const prevLine = i > 0 ? lines[i - 1] : '';
            const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
            if (prevLine.trim().length === 0 || nextLine.trim().length === 0) {
                smells.push({
                    type: 'Multiple blank lines',
                    line: lineNum,
                    description: 'Excessive blank lines reduce readability',
                    refactoring: 'Keep single blank line between sections',
                });
            }
        }
        if (line.trim().startsWith('// TODO') || line.trim().startsWith('// FIXME')) {
            smells.push({
                type: 'TODO/FIXME comment',
                line: lineNum,
                description: 'Unresolved TODO/FIXME in code',
                refactoring: 'Resolve or create issue tracker reference',
            });
        }
        const match = line.match(/function\s+(\w+)\s*\([^)]*\)\s*\{/);
        if (match) {
            const funcName = match[1];
            let braceCount = 1;
            let funcLength = 1;
            for (let j = i + 1; j < lines.length && braceCount > 0; j++) {
                funcLength++;
                braceCount += (lines[j].match(/{/g) || []).length;
                braceCount -= (lines[j].match(/}/g) || []).length;
            }
            if (funcLength > 50) {
                smells.push({
                    type: 'Long function',
                    line: lineNum,
                    description: `Function ${funcName} is ${funcLength} lines long`,
                    refactoring: 'Break into smaller functions with single responsibility',
                });
            }
        }
        if (line.match(/^(\s*)\{(\s*)$/) && i > 0) {
            const prevLine = lines[i - 1].trim();
            if (prevLine.endsWith(')') || prevLine.endsWith('else')) {
                smells.push({
                    type: 'Allman brace style',
                    line: lineNum,
                    description: 'Brace on new line (Allman style)',
                    refactoring: 'Use K&R style (brace on same line)',
                });
            }
        }
    }
    return smells;
}
function applyOptimizations(code, suggestions) {
    let optimized = code;
    for (const suggestion of suggestions) {
        if (suggestion.severity === 'low' || suggestion.type === 'readability') {
            continue;
        }
        if (suggestion.message.includes('console.log')) {
            const lines = optimized.split('\n');
            const lineIndex = suggestion.line - 1;
            if (lineIndex < lines.length) {
                lines[lineIndex] = lines[lineIndex].replace(/console\.log\([^)]*\);?/, '');
                optimized = lines.join('\n');
            }
        }
    }
    return optimized;
}
//# sourceMappingURL=code-optimizer.js.map