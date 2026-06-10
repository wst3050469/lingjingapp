// File Read tool - reads files with line numbers
import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
export const fileReadTool = {
    name: 'file_read',
    description: 'Read a file from the filesystem. Returns file content with line numbers. Supports offset and limit for large files.',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'The path to the file to read (absolute or relative to working directory)',
            },
            offset: {
                type: 'number',
                description: 'Line number to start reading from (1-based). Optional.',
            },
            limit: {
                type: 'number',
                description: 'Maximum number of lines to read. Optional, defaults to 2000.',
            },
        },
        required: ['file_path'],
    },
    async execute(params, context) {
        const filePath = params.file_path;
        const offset = params.offset ?? 1;
        const limit = params.limit ?? 2000;
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(context.workingDirectory, filePath);
        try {
            const content = await readFile(absolutePath, 'utf-8');
            const lines = content.split('\n');
            const startLine = Math.max(1, offset);
            const endLine = Math.min(lines.length, startLine + limit - 1);
            const selectedLines = lines.slice(startLine - 1, endLine);
            // Format with line numbers (like cat -n)
            const maxLineNumWidth = String(endLine).length;
            const formatted = selectedLines
                .map((line, i) => {
                const lineNum = String(startLine + i).padStart(maxLineNumWidth, ' ');
                // Truncate very long lines
                const truncatedLine = line.length > 2000 ? line.slice(0, 2000) + '...(truncated)' : line;
                return `${lineNum}\t${truncatedLine}`;
            })
                .join('\n');
            let header = `File: ${absolutePath}`;
            if (lines.length > endLine) {
                header += ` (showing lines ${startLine}-${endLine} of ${lines.length})`;
            }
            return { content: `${header}\n${formatted}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Error reading file ${absolutePath}: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=file-read.js.map