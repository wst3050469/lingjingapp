// Code chunker for codebase_search embedding pipeline
// Splits source files into overlapping line-based chunks for embedding
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
const DEFAULT_CHUNK_SIZE = 60;
const DEFAULT_OVERLAP = 10;
const MAX_FILE_SIZE = 100 * 1024; // 100KB
// Directories to always skip
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    '__pycache__', '.cache', '.lingjing', '.venv', 'venv',
    'vendor', '.svn', '.hg', 'coverage', '.nyc_output',
]);
// Binary / non-text extensions to skip
const SKIP_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.flac', '.wav',
    '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.lock', '.min.js', '.min.css',
    '.pyc', '.pyo', '.class', '.o', '.obj',
    '.sqlite', '.db', '.wasm',
]);
// Source extensions we want to index
const SOURCE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.pyi',
    '.go',
    '.rs',
    '.java', '.kt', '.scala',
    '.c', '.cpp', '.cc', '.h', '.hpp',
    '.cs',
    '.rb',
    '.php',
    '.swift',
    '.vue', '.svelte',
    '.html', '.css', '.scss', '.less',
    '.json', '.yaml', '.yml', '.toml',
    '.md', '.mdx', '.txt', '.rst',
    '.sh', '.bash', '.zsh', '.fish',
    '.sql',
    '.graphql', '.gql',
    '.proto',
    '.dockerfile',
    '.env.example',
    // Additional commonly used extensions
    '.dart', // Dart/Flutter
    '.ex', '.exs', // Elixir
    '.lua', // Lua
    '.r', '.rmd', // R
    '.m', '.mm', // Objective-C
    '.groovy', // Groovy
    '.gradle', // Gradle
    '.pl', '.pm', // Perl
    '.tcl', // Tcl
    '.clj', '.cljs', // Clojure
    '.erl', '.hrl', // Erlang
    '.hs', '.lhs', // Haskell
    '.ml', '.mli', // OCaml
    '.cr', // Crystal
    '.nim', // Nim
    '.zig', // Zig
    '.cmake', // CMake
    '.mk', // Makefile
    '.cfg', '.conf', // Config files
    '.properties', // Java properties
    '.env', // Environment files
]);
// Patterns that indicate a natural break point (function/class boundaries)
const BOUNDARY_PATTERNS = [
    /^export\s+(default\s+)?(function|class|const|let|var|interface|type|enum)\s/,
    /^(function|class|interface|type|enum)\s/,
    /^(async\s+)?function\s/,
    /^(pub\s+)?(fn|struct|enum|impl|trait|mod)\s/, // Rust
    /^(def|class|async\s+def)\s/, // Python
    /^func\s/, // Go
    /^(public|private|protected|static)\s/, // Java/C#
    /^(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/, // Arrow functions
];
function isBoundaryLine(line) {
    const trimmed = line.trimStart();
    return BOUNDARY_PATTERNS.some(p => p.test(trimmed));
}
function shouldSkipFile(fileName, ext) {
    if (SKIP_EXTENSIONS.has(ext))
        return true;
    if (fileName.endsWith('.min.js') || fileName.endsWith('.min.css'))
        return true;
    if (fileName.endsWith('.map'))
        return true;
    if (fileName.endsWith('.d.ts'))
        return true;
    // If we have source extensions defined, use allowlist
    if (SOURCE_EXTENSIONS.size > 0) {
        const lowerName = fileName.toLowerCase();
        if (lowerName === 'dockerfile' || lowerName === 'makefile' || lowerName === 'rakefile')
            return false;
        return !SOURCE_EXTENSIONS.has(ext);
    }
    return false;
}
function matchesIgnorePattern(relativePath, name, patterns) {
    for (const pattern of patterns) {
        const trimmed = pattern.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!'))
            continue;
        if (trimmed.endsWith('/')) {
            const dirName = trimmed.slice(0, -1);
            if (relativePath.includes(dirName + '/') || relativePath === dirName)
                return true;
        }
        else if (trimmed.startsWith('*.')) {
            const ext = trimmed.slice(1);
            if (name.endsWith(ext))
                return true;
        }
        else if (trimmed.startsWith('**/')) {
            const target = trimmed.slice(3);
            if (name === target || relativePath.includes('/' + target))
                return true;
        }
        else if (relativePath === trimmed || name === trimmed) {
            return true;
        }
    }
    return false;
}
/**
 * Chunk a single file's content into overlapping segments.
 */
export function chunkFileContent(filePath, content, options) {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = options?.overlap ?? DEFAULT_OVERLAP;
    const lines = content.split('\n');
    if (lines.length <= chunkSize) {
        // Small file: single chunk
        return [{
                filePath,
                startLine: 1,
                endLine: lines.length,
                text: content,
            }];
    }
    const chunks = [];
    let start = 0;
    while (start < lines.length) {
        let end = Math.min(start + chunkSize, lines.length);
        // Try to extend/shrink to a natural boundary
        if (end < lines.length) {
            // Look ahead up to 10 lines for a boundary
            for (let i = end; i < Math.min(end + 10, lines.length); i++) {
                if (isBoundaryLine(lines[i])) {
                    end = i;
                    break;
                }
            }
        }
        const chunkLines = lines.slice(start, end);
        chunks.push({
            filePath,
            startLine: start + 1,
            endLine: end,
            text: chunkLines.join('\n'),
        });
        // Advance with overlap
        start = end - overlap;
        if (start <= chunks[chunks.length - 1].startLine - 1) {
            // Avoid infinite loop
            start = end;
        }
    }
    return chunks;
}
/**
 * Scan workspace and produce chunks for all eligible source files.
 * Yields file-by-file to allow incremental processing.
 */
export async function* scanAndChunk(workspace, options) {
    const maxFileSize = options?.maxFileSize ?? MAX_FILE_SIZE;
    const ignorePatterns = options?.ignorePatterns ?? [];
    async function* walk(dir, depth) {
        if (depth > 15)
            return;
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.') && entry.isDirectory())
                continue;
            if (SKIP_DIRS.has(entry.name))
                continue;
            const fullPath = join(dir, entry.name);
            const relPath = relative(workspace, fullPath).replace(/\\/g, '/');
            if (matchesIgnorePattern(relPath, entry.name, ignorePatterns))
                continue;
            if (entry.isDirectory()) {
                yield* walk(fullPath, depth + 1);
            }
            else {
                const ext = extname(entry.name).toLowerCase();
                if (!shouldSkipFile(entry.name, ext)) {
                    yield fullPath;
                }
            }
        }
    }
    for await (const filePath of walk(workspace, 0)) {
        try {
            const fileStat = await stat(filePath);
            if (fileStat.size > maxFileSize || fileStat.size === 0)
                continue;
            const content = await readFile(filePath, 'utf8');
            // Skip likely binary content
            if (content.includes('\0'))
                continue;
            const relPath = relative(workspace, filePath).replace(/\\/g, '/');
            const chunks = chunkFileContent(relPath, content, options);
            const mtime = fileStat.mtime.toISOString();
            yield { file: relPath, mtime, chunks };
        }
        catch {
            // Skip files we can't read
        }
    }
}
//# sourceMappingURL=chunker.js.map