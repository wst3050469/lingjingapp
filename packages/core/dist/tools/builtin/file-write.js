// File Write tool - creates or overwrites files
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, isAbsolute, dirname } from 'node:path';
export const fileWriteTool = {
    name: 'file_write',
    description: 'Write content to a file. Creates the file if it does not exist, or overwrites it if it does. Also creates parent directories if needed.',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'The path to the file to write (absolute or relative to working directory)',
            },
            content: {
                type: 'string',
                description: 'The content to write to the file',
            },
        },
        required: ['file_path', 'content'],
    },
    async execute(params, context) {
        const filePath = params.file_path;
        const content = params.content;
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(context.workingDirectory, filePath);
        try {
            // Ensure parent directory exists
            await mkdir(dirname(absolutePath), { recursive: true });
            await writeFile(absolutePath, content, 'utf-8');
            const lineCount = content.split('\n').length;
            return { content: `Successfully wrote ${lineCount} lines to ${absolutePath}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Error writing file ${absolutePath}: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=file-write.js.map