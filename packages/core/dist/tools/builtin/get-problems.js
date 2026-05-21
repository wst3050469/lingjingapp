// get_problems tool - Get code diagnostics via LSP
// Uses module-level injection pattern for the diagnostics function
let _getDiagnosticsFn = null;
/**
 * Initialize the get_problems tool with the diagnostics function from electron layer.
 */
export function initGetProblemsTool(getDiagnosticsFn) {
    _getDiagnosticsFn = getDiagnosticsFn;
}
export const getProblemsTool = {
    name: 'get_problems',
    description: 'Get code problems (compile errors, lint warnings, type errors) for a file or the entire project. Uses the Language Server Protocol for accurate diagnostics. Requires a language server (e.g. typescript-language-server, pyright) to be installed.',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'Absolute path to the file to check. If omitted, returns diagnostics for all open files in the project.',
            },
            severity: {
                type: 'string',
                enum: ['error', 'warning', 'all'],
                description: 'Filter by severity level. Default is "all".',
            },
        },
        required: [],
    },
    async execute(params, context) {
        const filePath = params.file_path;
        const severity = params.severity || 'all';
        if (!_getDiagnosticsFn) {
            return {
                content: 'get_problems is not available. The LSP service has not been initialized.',
                isError: true,
            };
        }
        try {
            const result = await _getDiagnosticsFn(filePath, context.workingDirectory, severity);
            if (!result || result.trim() === '') {
                const target = filePath ? filePath.split(/[/\\]/).pop() : 'project';
                return {
                    content: `No problems found in ${target}.`,
                    isError: false,
                };
            }
            return { content: result, isError: false };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { content: `Error getting problems: ${message}`, isError: true };
        }
    },
};
//# sourceMappingURL=get-problems.js.map