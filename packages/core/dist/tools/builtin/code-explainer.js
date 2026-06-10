let _llmProvider = null;
export function initCodeExplainerTool(provider) {
    _llmProvider = provider;
}
export const codeExplainerTool = {
    name: 'code_explainer',
    description: 'Explain code in detail with visualizations. Provides dependency graphs, complexity analysis, and documentation generation.',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'Path to the source file to explain',
            },
            line_start: {
                type: 'number',
                description: 'Start line number (optional)',
            },
            line_end: {
                type: 'number',
                description: 'End line number (optional)',
            },
            include_deps: {
                type: 'boolean',
                description: 'Include dependency analysis (default: true)',
            },
            include_visualization: {
                type: 'boolean',
                description: 'Generate dependency graph (default: false)',
            },
            detail_level: {
                type: 'string',
                enum: ['brief', 'normal', 'detailed'],
                description: 'Level of explanation detail (default: normal)',
            },
        },
        required: ['file_path'],
    },
    async execute(params, context) {
        const filePath = params.file_path;
        const lineStart = params.line_start;
        const lineEnd = params.line_end;
        const includeDeps = params.include_deps ?? true;
        const includeVisualization = params.include_visualization ?? false;
        const detailLevel = params.detail_level || 'normal';
        try {
            const { readFileSync, existsSync } = await import('fs');
            const { extname, basename } = await import('path');
            if (!existsSync(filePath)) {
                return {
                    content: `Error: File not found: ${filePath}`,
                    isError: true,
                };
            }
            const fullCode = readFileSync(filePath, 'utf-8');
            const ext = extname(filePath);
            const fileName = basename(filePath);
            let targetCode = fullCode;
            let lineRange = '';
            if (lineStart && lineEnd) {
                const lines = fullCode.split('\n');
                targetCode = lines.slice(lineStart - 1, lineEnd).join('\n');
                lineRange = ` (lines ${lineStart}-${lineEnd})`;
            }
            context.onProgress?.(`Analyzing ${fileName}${lineRange}...`);
            const elements = parseCodeElements(targetCode, ext);
            context.onProgress?.('Analyzing complexity...');
            const complexity = analyzeComplexity(targetCode);
            let dependencies = [];
            let dependencyGraph = '';
            if (includeDeps) {
                context.onProgress?.('Analyzing dependencies...');
                dependencies = analyzeDependencies(targetCode, fileName);
                if (includeVisualization) {
                    dependencyGraph = generateDependencyGraph(dependencies, fileName);
                }
            }
            const explanation = generateExplanation(elements, complexity, dependencies, detailLevel, fileName);
            const summary = `📖 Code Explanation for ${fileName}${lineRange}\n\n` +
                `## Overview\n\n` +
                `File type: ${ext}\n` +
                `Lines of code: ${targetCode.split('\n').length}\n` +
                `Complexity score: ${complexity.score}\n` +
                `Elements found: ${elements.length}\n\n` +
                explanation +
                (dependencies.length > 0
                    ? `\n## Dependencies (${dependencies.length})\n\n` +
                        dependencies.slice(0, 10).map(d => `  • ${d.from} → ${d.to} (${d.type})`).join('\n')
                    : '') +
                (dependencyGraph
                    ? '\n\n## Dependency Graph\n\n```\n' + dependencyGraph + '\n```\n'
                    : '') +
                `\n## Code Snippet\n\n\`\`\`${ext}\n${targetCode.slice(0, 500)}${targetCode.length > 500 ? '\n...' : ''}\n\`\`\``;
            return { content: summary };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: `Failed to explain code: ${msg}`,
                isError: true,
            };
        }
    },
};
function parseCodeElements(code, ext) {
    const elements = [];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*[=\(]/);
        if (funcMatch) {
            elements.push({
                type: 'function',
                name: funcMatch[1],
                line: lineNum,
                complexity: calculateFunctionComplexity(lines, i),
            });
        }
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) {
            elements.push({
                type: 'class',
                name: classMatch[1],
                line: lineNum,
            });
        }
        const importMatch = line.match(/import\s+.*?from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
            elements.push({
                type: 'import',
                name: importMatch[1],
                line: lineNum,
            });
        }
        const exportMatch = line.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*(\w+)/);
        if (exportMatch) {
            elements.push({
                type: 'export',
                name: exportMatch[1],
                line: lineNum,
            });
        }
    }
    return elements;
}
function calculateFunctionComplexity(lines, startIndex) {
    let complexity = 1;
    let braceCount = 0;
    let started = false;
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('{')) {
            braceCount += (line.match(/{/g) || []).length;
            started = true;
        }
        if (line.includes('}')) {
            braceCount -= (line.match(/}/g) || []).length;
        }
        if (started && braceCount === 0) {
            break;
        }
        complexity += (line.match(/\bif\b/g) || []).length;
        complexity += (line.match(/\bfor\b/g) || []).length;
        complexity += (line.match(/\bwhile\b/g) || []).length;
        complexity += (line.match(/\bswitch\b/g) || []).length;
        complexity += (line.match(/&&/g) || []).length;
        complexity += (line.match(/\|\|/g) || []).length;
        complexity += (line.match(/\?/g) || []).length;
    }
    return complexity;
}
function analyzeComplexity(code) {
    const lines = code.split('\n');
    let totalComplexity = 0;
    let functionCount = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/function\s+\w+/) || line.match(/=>\s*{/)) {
            totalComplexity += calculateFunctionComplexity(lines, i);
            functionCount++;
        }
    }
    const avgComplexity = functionCount > 0 ? totalComplexity / functionCount : 1;
    let rating = 'Low';
    if (avgComplexity > 10)
        rating = 'High';
    else if (avgComplexity > 5)
        rating = 'Medium';
    return {
        score: Math.round(avgComplexity),
        rating,
    };
}
function analyzeDependencies(code, fileName) {
    const dependencies = [];
    const lines = code.split('\n');
    for (const line of lines) {
        const importMatch = line.match(/import\s+.*?from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
            dependencies.push({
                from: fileName,
                to: importMatch[1],
                type: 'import',
            });
        }
        const callMatch = line.match(/(\w+)\s*\(/);
        if (callMatch && !line.includes('function') && !line.includes('const')) {
            dependencies.push({
                from: fileName,
                to: callMatch[1],
                type: 'call',
            });
        }
    }
    return dependencies;
}
function generateDependencyGraph(dependencies, fileName) {
    const nodes = new Set();
    const edges = [];
    nodes.add(fileName);
    for (const dep of dependencies) {
        nodes.add(dep.to);
        edges.push(`  ${dep.from} --> ${dep.to}`);
    }
    const graph = `graph TD
${Array.from(nodes).map(n => `  ${n}[${n}]`).join('\n')}
${edges.join('\n')}`;
    return graph;
}
function generateExplanation(elements, complexity, dependencies, detailLevel, fileName) {
    const sections = [];
    sections.push(`## Elements\n`);
    const functions = elements.filter(e => e.type === 'function');
    const classes = elements.filter(e => e.type === 'class');
    const imports = elements.filter(e => e.type === 'import');
    const exports = elements.filter(e => e.type === 'export');
    if (functions.length > 0) {
        sections.push(`### Functions (${functions.length})`);
        for (const func of functions) {
            const complexityInfo = func.complexity ? ` (complexity: ${func.complexity})` : '';
            sections.push(`  • ${func.name} at line ${func.line}${complexityInfo}`);
            if (detailLevel === 'detailed' && func.complexity && func.complexity > 10) {
                sections.push(`    ⚠️ High complexity - consider refactoring`);
            }
        }
        sections.push('');
    }
    if (classes.length > 0) {
        sections.push(`### Classes (${classes.length})`);
        for (const cls of classes) {
            sections.push(`  • ${cls.name} at line ${cls.line}`);
        }
        sections.push('');
    }
    if (imports.length > 0) {
        sections.push(`### Imports (${imports.length})`);
        for (const imp of imports) {
            sections.push(`  • ${imp.name}`);
        }
        sections.push('');
    }
    if (exports.length > 0) {
        sections.push(`### Exports (${exports.length})`);
        for (const exp of exports) {
            sections.push(`  • ${exp.name}`);
        }
        sections.push('');
    }
    sections.push(`## Complexity Analysis\n`);
    sections.push(`  Average complexity: ${complexity.score}`);
    sections.push(`  Rating: ${complexity.rating}`);
    if (complexity.rating === 'High') {
        sections.push(`  ⚠️ Consider breaking down complex functions`);
    }
    return sections.join('\n');
}
//# sourceMappingURL=code-explainer.js.map