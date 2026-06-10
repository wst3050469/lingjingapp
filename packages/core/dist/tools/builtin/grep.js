// Grep tool - content search using regex
import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';
import { resolve, isAbsolute } from 'node:path';
export const grepTool = {
    name: 'grep',
    description: 'Search for a regex pattern in file contents. Can filter by file type using glob. Returns matching lines with file paths and line numbers.',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'The regex pattern to search for',
            },
            path: {
                type: 'string',
                description: 'File or directory to search in. Defaults to working directory.',
            },
            glob: {
                type: 'string',
                description: 'Glob pattern to filter files (e.g. "*.ts", "*.{js,jsx}")',
            },
            case_insensitive: {
                type: 'boolean',
                description: 'Case insensitive search. Default: false',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of matches to return. Default: 100',
            },
        },
        required: ['pattern'],
    },
    async execute(params, context) {
        const pattern = params.pattern;
        const searchPath = params.path;
        const globPattern = params.glob;
        const caseInsensitive = params.case_insensitive ?? false;
        const maxResults = params.max_results ?? 100;
        const cwd = searchPath
            ? (isAbsolute(searchPath) ? searchPath : resolve(context.workingDirectory, searchPath))
            : context.workingDirectory;
        try {
            const regex = new RegExp(pattern, caseInsensitive ? 'gi' : 'g');
            // Find files to search
            const filePattern = globPattern ?? '**/*';
            const files = await fg(filePattern, {
                cwd,
                dot: false,
                ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.min.*'],
                onlyFiles: true,
            });
            const matches = [];
            let totalMatches = 0;
            for (const filePath of files) {
                if (totalMatches >= maxResults)
                    break;
                const fullPath = resolve(cwd, filePath);
                try {
                    const content = await readFile(fullPath, 'utf-8');
                    // Skip binary files
                    if (content.includes('\0'))
                        continue;
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (totalMatches >= maxResults)
                            break;
                        if (regex.test(lines[i])) {
                            matches.push(`${filePath}:${i + 1}: ${lines[i].trim()}`);
                            totalMatches++;
                        }
                        regex.lastIndex = 0; // Reset regex state
                    }
                }
                catch {
                    // Skip unreadable files
                    continue;
                }
            }
            if (matches.length === 0) {
                return { content: `No matches found for pattern "${pattern}" in ${cwd}` };
            }
            let result = matches.join('\n');
            if (totalMatches >= maxResults) {
                result += `\n\n(Results limited to ${maxResults} matches)`;
            }
            return { content: `Found ${totalMatches} match(es):\n${result}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('Invalid regular expression')) {
                return { content: `Invalid regex pattern: ${msg}`, isError: true };
            }
            return { content: `Error searching: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=grep.js.map