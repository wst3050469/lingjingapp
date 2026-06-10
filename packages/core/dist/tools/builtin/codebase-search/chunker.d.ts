export interface CodeChunk {
    filePath: string;
    startLine: number;
    endLine: number;
    text: string;
}
export interface ChunkerOptions {
    chunkSize?: number;
    overlap?: number;
    maxFileSize?: number;
    ignorePatterns?: string[];
}
/**
 * Chunk a single file's content into overlapping segments.
 */
export declare function chunkFileContent(filePath: string, content: string, options?: ChunkerOptions): CodeChunk[];
/**
 * Scan workspace and produce chunks for all eligible source files.
 * Yields file-by-file to allow incremental processing.
 */
export declare function scanAndChunk(workspace: string, options?: ChunkerOptions): AsyncGenerator<{
    file: string;
    mtime: string;
    chunks: CodeChunk[];
}>;
//# sourceMappingURL=chunker.d.ts.map