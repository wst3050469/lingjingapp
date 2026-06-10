// List directory tool - browse directory structure with metadata
import { readdir, stat } from 'node:fs/promises';
import { resolve, isAbsolute, join, relative } from 'node:path';
const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    '__pycache__', '.cache', '.lingjing', '.vscode', '.idea',
    'coverage', '.turbo', '.output', 'out',
]);
const MAX_ENTRIES = 200;
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
async function listRecursive(dirPath, basePath, depth, maxDepth, showHidden, entries, prefix) {
    if (depth > maxDepth || entries.length >= MAX_ENTRIES)
        return;
    let items;
    try {
        items = await readdir(dirPath, { withFileTypes: true });
    }
    catch {
        entries.push(`${prefix}(permission denied)`);
        return;
    }
    // Filter hidden files
    if (!showHidden) {
        items = items.filter(item => !item.name.startsWith('.'));
    }
    // Separate directories and files, sort alphabetically
    const dirs = items.filter(i => i.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = items.filter(i => !i.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    // Directories first
    for (const dir of dirs) {
        if (entries.length >= MAX_ENTRIES)
            break;
        if (IGNORED_DIRS.has(dir.name))
            continue;
        const fullPath = join(dirPath, dir.name);
        const relPath = relative(basePath, fullPath);
        entries.push(`${prefix}${relPath}/`);
        if (depth < maxDepth) {
            await listRecursive(fullPath, basePath, depth + 1, maxDepth, showHidden, entries, prefix + '  ');
        }
    }
    // Then files
    for (const file of files) {
        if (entries.length >= MAX_ENTRIES)
            break;
        const fullPath = join(dirPath, file.name);
        const relPath = relative(basePath, fullPath);
        let sizeStr = '';
        try {
            const s = await stat(fullPath);
            sizeStr = ` (${formatSize(s.size)})`;
        }
        catch {
            // Skip stat errors
        }
        entries.push(`${prefix}${relPath}${sizeStr}`);
    }
}
export const listDirTool = {
    name: 'list_dir',
    description: 'List directory contents with file/folder structure and file sizes. Use to browse project directory trees.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Directory path to list (absolute or relative to working directory)',
            },
            depth: {
                type: 'number',
                description: 'Recursion depth (1 = immediate children only, max 5). Default: 1',
            },
            show_hidden: {
                type: 'boolean',
                description: 'Show hidden files/directories (starting with "."). Default: false',
            },
        },
        required: ['path'],
    },
    async execute(params, context) {
        const inputPath = params.path;
        const depth = Math.min(Math.max(params.depth ?? 1, 1), 5);
        const showHidden = params.show_hidden ?? false;
        const targetDir = isAbsolute(inputPath)
            ? inputPath
            : resolve(context.workingDirectory, inputPath);
        // Verify the path is a directory
        try {
            const s = await stat(targetDir);
            if (!s.isDirectory()) {
                return { content: `Error: "${inputPath}" is not a directory.`, isError: true };
            }
        }
        catch {
            return { content: `Error: Directory "${inputPath}" not found.`, isError: true };
        }
        const entries = [];
        await listRecursive(targetDir, targetDir, 1, depth, showHidden, entries, '');
        if (entries.length === 0) {
            return { content: `Directory "${inputPath}" is empty.` };
        }
        let output = `Directory: ${targetDir}\n`;
        output += `(${entries.length}${entries.length >= MAX_ENTRIES ? '+' : ''} entries, depth ${depth})\n\n`;
        output += entries.join('\n');
        if (entries.length >= MAX_ENTRIES) {
            output += `\n\n(Output truncated at ${MAX_ENTRIES} entries. Use a smaller depth or target a subdirectory.)`;
        }
        return { content: output };
    },
};
//# sourceMappingURL=list-dir.js.map