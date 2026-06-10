// File Edit tool - exact string replacement in files
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
export const fileEditTool = {
    name: 'file_edit',
    description: 'Perform exact string replacements in files. The old_string must match exactly (including whitespace and indentation). If replace_all is true, replaces all occurrences; otherwise only works if old_string is unique in the file.',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'The path to the file to edit',
            },
            old_string: {
                type: 'string',
                description: 'The exact text to find and replace',
            },
            new_string: {
                type: 'string',
                description: 'The replacement text',
            },
            replace_all: {
                type: 'boolean',
                description: 'If true, replace all occurrences. Default: false',
            },
        },
        required: ['file_path', 'old_string', 'new_string'],
    },
    async execute(params, context) {
        const filePath = params.file_path;
        const oldString = params.old_string;
        const newString = params.new_string;
        const replaceAll = params.replace_all ?? false;
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(context.workingDirectory, filePath);
        try {
            const content = await readFile(absolutePath, 'utf-8');
            if (!content.includes(oldString)) {
                return {
                    content: `Error: old_string not found in ${absolutePath}. Make sure the string matches exactly including whitespace.`,
                    isError: true,
                };
            }
            if (!replaceAll) {
                // Check uniqueness
                const firstIdx = content.indexOf(oldString);
                const secondIdx = content.indexOf(oldString, firstIdx + 1);
                if (secondIdx !== -1) {
                    const count = content.split(oldString).length - 1;
                    return {
                        content: `Error: old_string appears ${count} times in ${absolutePath}. Use replace_all: true to replace all occurrences, or provide more surrounding context to make it unique.`,
                        isError: true,
                    };
                }
            }
            let newContent;
            if (replaceAll) {
                newContent = content.split(oldString).join(newString);
            }
            else {
                newContent = content.replace(oldString, newString);
            }
            await writeFile(absolutePath, newContent, 'utf-8');
            const replacements = replaceAll ? content.split(oldString).length - 1 : 1;
            return { content: `Successfully made ${replacements} replacement(s) in ${absolutePath}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Error editing file ${absolutePath}: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=file-edit.js.map