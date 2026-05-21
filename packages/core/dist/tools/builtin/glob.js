// Glob tool - file pattern matching
import fg from 'fast-glob';
import { resolve, isAbsolute } from 'node:path';
export const globTool = {
    name: 'glob',
    description: 'Find files matching a glob pattern (e.g. "**/*.ts", "src/**/*.js"). Returns matching file paths.',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'The glob pattern to match files against',
            },
            path: {
                type: 'string',
                description: 'Directory to search in. Defaults to working directory.',
            },
        },
        required: ['pattern'],
    },
    async execute(params, context) {
        const pattern = params.pattern;
        const searchPath = params.path;
        const cwd = searchPath
            ? (isAbsolute(searchPath) ? searchPath : resolve(context.workingDirectory, searchPath))
            : context.workingDirectory;
        try {
            const files = await fg(pattern, {
                cwd,
                dot: false,
                ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
                onlyFiles: true,
                stats: true,
            });
            // Sort by modification time (most recent first)
            files.sort((a, b) => {
                const aTime = a.stats?.mtimeMs ?? 0;
                const bTime = b.stats?.mtimeMs ?? 0;
                return bTime - aTime;
            });
            if (files.length === 0) {
                return { content: `No files matched pattern "${pattern}" in ${cwd}` };
            }
            const fileList = files.map((f) => f.path).join('\n');
            return { content: `Found ${files.length} file(s):\n${fileList}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Error searching for files: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=glob.js.map