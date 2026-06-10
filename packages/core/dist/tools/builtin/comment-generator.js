let _llmProvider = null;
export function initCommentGeneratorTool(provider) {
    _llmProvider = provider;
}
export const commentGeneratorTool = {
    name: 'comment_generator',
    description: 'Generate code comments and documentation in multiple styles (JSDoc, JavaDoc, Python Docstring). Supports function, class, and inline comments.',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'Path to the source file',
            },
            style: {
                type: 'string',
                enum: ['jsdoc', 'javadoc', 'docstring', 'auto'],
                description: 'Comment style (default: auto-detect)',
            },
            scope: {
                type: 'string',
                enum: ['all', 'functions', 'classes', 'methods'],
                description: 'Scope of comments to generate (default: all)',
            },
            include_params: {
                type: 'boolean',
                description: 'Include parameter descriptions (default: true)',
            },
            include_returns: {
                type: 'boolean',
                description: 'Include return value descriptions (default: true)',
            },
            include_examples: {
                type: 'boolean',
                description: 'Include usage examples (default: false)',
            },
            check_quality: {
                type: 'boolean',
                description: 'Check existing comment quality (default: false)',
            },
        },
        required: ['file_path'],
    },
    async execute(params, context) {
        const filePath = params.file_path;
        const style = params.style || 'auto';
        const scope = params.scope || 'all';
        const includeParams = params.include_params ?? true;
        const includeReturns = params.include_returns ?? true;
        const includeExamples = params.include_examples ?? false;
        const checkQuality = params.check_quality ?? false;
        try {
            const { readFileSync, existsSync } = await import('fs');
            const { extname } = await import('path');
            if (!existsSync(filePath)) {
                return {
                    content: `Error: File not found: ${filePath}`,
                    isError: true,
                };
            }
            const sourceCode = readFileSync(filePath, 'utf-8');
            const ext = extname(filePath);
            const detectedStyle = style === 'auto' ? detectCommentStyle(ext) : style;
            context.onProgress?.(`Analyzing ${filePath}...`);
            const codeElements = parseCodeElements(sourceCode, ext);
            if (checkQuality) {
                context.onProgress?.('Checking comment quality...');
                const quality = checkCommentQuality(sourceCode, codeElements);
                return {
                    content: `📝 Comment Quality Report for ${filePath}\n\n` +
                        `Coverage: ${quality.coverage}%\n` +
                        `Missing comments: ${quality.missing.length}\n\n` +
                        `Elements without comments:\n${quality.missing.map(e => `  • ${e.type} ${e.name} (line ${e.line})`).join('\n')}\n\n` +
                        `Recommendations:\n${quality.recommendations.map(r => `  • ${r}`).join('\n')}`,
                };
            }
            context.onProgress?.(`Generating ${detectedStyle} comments...`);
            const comments = generateComments(codeElements, {
                style: detectedStyle,
                includeParams,
                includeReturns,
                includeExamples,
            });
            const commentedCode = applyComments(sourceCode, comments);
            const summary = `✅ Generated comments for ${filePath}\n\n` +
                `Style: ${detectedStyle}\n` +
                `Scope: ${scope}\n` +
                `Elements commented: ${comments.length}\n\n` +
                `Commented elements:\n${comments.map(c => `  • ${c.type} ${c.name} (${c.line})`).join('\n')}\n\n` +
                `[COMMENTED_CODE]\n${commentedCode}`;
            return { content: summary };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: `Failed to generate comments: ${msg}`,
                isError: true,
            };
        }
    },
};
function detectCommentStyle(ext) {
    const styleMap = {
        '.ts': 'jsdoc',
        '.tsx': 'jsdoc',
        '.js': 'jsdoc',
        '.jsx': 'jsdoc',
        '.py': 'docstring',
        '.java': 'javadoc',
    };
    return styleMap[ext] || 'jsdoc';
}
function parseCodeElements(code, ext) {
    const elements = [];
    const lines = code.split('\n');
    const functionRegex = ext === '.py'
        ? /^def\s+(\w+)\s*\(([^)]*)\)/
        : /^function\s+(\w+)\s*\(([^)]*)\)/;
    const arrowFunctionRegex = /^(const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/;
    const classRegex = ext === '.py'
        ? /^class\s+(\w+)/
        : /^class\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match = line.match(functionRegex);
        if (match) {
            elements.push({
                type: 'function',
                name: match[1],
                line: i + 1,
                params: match[2].split(',').map(p => p.trim()).filter(p => p),
            });
            continue;
        }
        match = line.match(arrowFunctionRegex);
        if (match) {
            elements.push({
                type: 'function',
                name: match[2],
                line: i + 1,
                params: match[3].split(',').map(p => p.trim()).filter(p => p),
            });
            continue;
        }
        match = line.match(classRegex);
        if (match) {
            elements.push({
                type: 'class',
                name: match[1],
                line: i + 1,
            });
        }
    }
    return elements;
}
function generateComments(elements, config) {
    const comments = [];
    for (const element of elements) {
        let comment = '';
        if (config.style === 'jsdoc') {
            comment = generateJSDoc(element, config);
        }
        else if (config.style === 'javadoc') {
            comment = generateJavaDoc(element, config);
        }
        else if (config.style === 'docstring') {
            comment = generateDocstring(element, config);
        }
        comments.push({
            type: element.type,
            name: element.name,
            line: element.line,
            comment,
        });
    }
    return comments;
}
function generateJSDoc(element, config) {
    const lines = ['/**'];
    lines.push(` * ${element.name} - TODO: Add description`);
    if (config.includeParams && element.params && element.params.length > 0) {
        lines.push(' *');
        for (const param of element.params) {
            const paramName = param.split(':')[0].trim();
            lines.push(` * @param {any} ${paramName} - TODO: Add description`);
        }
    }
    if (config.includeReturns && element.type === 'function') {
        lines.push(' *');
        lines.push(` * @returns {${element.returnType || 'any'}} TODO: Add description`);
    }
    if (config.includeExamples) {
        lines.push(' *');
        lines.push(' * @example');
        lines.push(` * // TODO: Add example`);
    }
    lines.push(' */');
    return lines.join('\n');
}
function generateJavaDoc(element, config) {
    const lines = ['/**'];
    lines.push(` * ${element.name} - TODO: Add description`);
    if (config.includeParams && element.params && element.params.length > 0) {
        for (const param of element.params) {
            lines.push(` * @param ${param} TODO: Add description`);
        }
    }
    if (config.includeReturns && element.type === 'function') {
        lines.push(` * @return TODO: Add description`);
    }
    lines.push(' */');
    return lines.join('\n');
}
function generateDocstring(element, config) {
    const lines = [`"""${element.name} - TODO: Add description`];
    if (config.includeParams && element.params && element.params.length > 0) {
        lines.push('');
        lines.push('Args:');
        for (const param of element.params) {
            lines.push(`    ${param}: TODO: Add description`);
        }
    }
    if (config.includeReturns && element.type === 'function') {
        lines.push('');
        lines.push('Returns:');
        lines.push(`    TODO: Add description`);
    }
    lines.push('"""');
    return lines.join('\n');
}
function applyComments(code, comments) {
    const lines = code.split('\n');
    const sortedComments = [...comments].sort((a, b) => b.line - a.line);
    for (const { line, comment } of sortedComments) {
        const insertIndex = line - 1;
        lines.splice(insertIndex, 0, comment);
    }
    return lines.join('\n');
}
function checkCommentQuality(code, elements) {
    const lines = code.split('\n');
    const missing = [];
    for (const element of elements) {
        const lineIndex = element.line - 1;
        const hasComment = lineIndex > 0 && (lines[lineIndex - 1].trim().startsWith('/**') ||
            lines[lineIndex - 1].trim().startsWith('*') ||
            lines[lineIndex - 1].trim().startsWith('#') ||
            lines[lineIndex - 1].trim().startsWith('"""'));
        if (!hasComment) {
            missing.push({
                type: element.type,
                name: element.name,
                line: element.line,
            });
        }
    }
    const coverage = elements.length > 0
        ? Math.round(((elements.length - missing.length) / elements.length) * 100)
        : 100;
    const recommendations = [];
    if (missing.length > 0) {
        recommendations.push('Add comments to undocumented functions and classes');
    }
    if (coverage < 50) {
        recommendations.push('Comment coverage is low. Consider documenting key functions');
    }
    return { coverage, missing, recommendations };
}
//# sourceMappingURL=comment-generator.js.map