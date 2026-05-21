export const explainCommand = {
    name: 'explain',
    description: 'Explain code in detail with visualizations',
    usage: '/explain [file_path] [line_start-line_end]',
    examples: [
        '/explain src/utils/helper.ts',
        '/explain src/utils/helper.ts 10-50',
    ],
    parameters: [
        {
            name: 'file_path',
            type: 'file',
            required: true,
            description: 'Path to the file to explain',
        },
        {
            name: 'line_range',
            type: 'string',
            required: false,
            description: 'Line range (e.g., 10-50)',
        },
    ],
    async execute(args, context) {
        const parts = args.trim().split(/\s+/);
        if (parts.length === 0 || !parts[0]) {
            return {
                success: false,
                message: 'Usage: /explain [file_path] [line_range]',
            };
        }
        const filePath = parts[0];
        const lineRange = parts[1];
        return {
            success: true,
            message: `Explaining ${filePath}${lineRange ? ` lines ${lineRange}` : ''}`,
            data: {
                type: 'explain',
                filePath,
                lineRange,
                workingDirectory: context.workingDirectory,
            },
        };
    },
};
export const testCommand = {
    name: 'test',
    description: 'Generate unit tests for code',
    usage: '/test [file_path] [method_name]',
    examples: [
        '/test src/utils/helper.ts',
        '/test src/utils/helper.ts calculateSum',
    ],
    parameters: [
        {
            name: 'file_path',
            type: 'file',
            required: true,
            description: 'Path to the file to generate tests for',
        },
        {
            name: 'method_name',
            type: 'string',
            required: false,
            description: 'Specific method to test',
        },
    ],
    async execute(args, context) {
        const parts = args.trim().split(/\s+/);
        if (parts.length === 0 || !parts[0]) {
            return {
                success: false,
                message: 'Usage: /test [file_path] [method_name]',
            };
        }
        const filePath = parts[0];
        const methodName = parts[1];
        return {
            success: true,
            message: `Generating tests for ${filePath}${methodName ? ` method ${methodName}` : ''}`,
            data: {
                type: 'test',
                filePath,
                methodName,
                workingDirectory: context.workingDirectory,
            },
        };
    },
};
export const refactorCommand = {
    name: 'refactor',
    description: 'Refactor code with best practices',
    usage: '/refactor [file_path] [options]',
    examples: [
        '/refactor src/utils/helper.ts',
        '/refactor src/utils/helper.ts --extract-method',
    ],
    parameters: [
        {
            name: 'file_path',
            type: 'file',
            required: true,
            description: 'Path to the file to refactor',
        },
        {
            name: 'options',
            type: 'string',
            required: false,
            description: 'Refactoring options',
        },
    ],
    async execute(args, context) {
        const parts = args.trim().split(/\s+/);
        if (parts.length === 0 || !parts[0]) {
            return {
                success: false,
                message: 'Usage: /refactor [file_path] [options]',
            };
        }
        const filePath = parts[0];
        const options = parts.slice(1);
        return {
            success: true,
            message: `Refactoring ${filePath}`,
            data: {
                type: 'refactor',
                filePath,
                options,
                workingDirectory: context.workingDirectory,
            },
        };
    },
};
export const commentCommand = {
    name: 'comment',
    description: 'Generate code comments and documentation',
    usage: '/comment [file_path] [style]',
    examples: [
        '/comment src/utils/helper.ts',
        '/comment src/utils/helper.ts jsdoc',
    ],
    parameters: [
        {
            name: 'file_path',
            type: 'file',
            required: true,
            description: 'Path to the file to add comments',
        },
        {
            name: 'style',
            type: 'string',
            required: false,
            description: 'Comment style (jsdoc, javadoc, docstring)',
        },
    ],
    async execute(args, context) {
        const parts = args.trim().split(/\s+/);
        if (parts.length === 0 || !parts[0]) {
            return {
                success: false,
                message: 'Usage: /comment [file_path] [style]',
            };
        }
        const filePath = parts[0];
        const style = parts[1] || 'auto';
        return {
            success: true,
            message: `Adding comments to ${filePath} with style ${style}`,
            data: {
                type: 'comment',
                filePath,
                style,
                workingDirectory: context.workingDirectory,
            },
        };
    },
};
export const optimizeCommand = {
    name: 'optimize',
    description: 'Optimize code for performance',
    usage: '/optimize [file_path] [focus_area]',
    examples: [
        '/optimize src/utils/helper.ts',
        '/optimize src/utils/helper.ts performance',
    ],
    parameters: [
        {
            name: 'file_path',
            type: 'file',
            required: true,
            description: 'Path to the file to optimize',
        },
        {
            name: 'focus_area',
            type: 'string',
            required: false,
            description: 'Focus area (performance, memory, readability)',
        },
    ],
    async execute(args, context) {
        const parts = args.trim().split(/\s+/);
        if (parts.length === 0 || !parts[0]) {
            return {
                success: false,
                message: 'Usage: /optimize [file_path] [focus_area]',
            };
        }
        const filePath = parts[0];
        const focusArea = parts[1] || 'performance';
        return {
            success: true,
            message: `Optimizing ${filePath} for ${focusArea}`,
            data: {
                type: 'optimize',
                filePath,
                focusArea,
                workingDirectory: context.workingDirectory,
            },
        };
    },
};
export const reviewCommand = {
    name: 'review',
    description: 'Perform comprehensive code review',
    usage: '/review [scope] [target]',
    examples: [
        '/review diff',
        '/review file src/utils/helper.ts',
        '/review project',
    ],
    parameters: [
        {
            name: 'scope',
            type: 'string',
            required: true,
            description: 'Review scope (diff, file, project, pr)',
        },
        {
            name: 'target',
            type: 'string',
            required: false,
            description: 'Target (file path, PR number)',
        },
    ],
    async execute(args, context) {
        const parts = args.trim().split(/\s+/);
        if (parts.length === 0 || !parts[0]) {
            return {
                success: false,
                message: 'Usage: /review [scope] [target]',
            };
        }
        const scope = parts[0];
        const target = parts[1];
        return {
            success: true,
            message: `Reviewing ${scope}${target ? `: ${target}` : ''}`,
            data: {
                type: 'review',
                scope,
                target,
                workingDirectory: context.workingDirectory,
            },
        };
    },
};
export const helpCommand = {
    name: 'help',
    description: 'Show help for slash commands',
    usage: '/help [command_name]',
    examples: [
        '/help',
        '/help explain',
    ],
    async execute(args, context) {
        return {
            success: true,
            message: 'Displaying help information',
            data: {
                type: 'help',
                commandName: args.trim() || undefined,
            },
        };
    },
};
//# sourceMappingURL=builtin.js.map