import type { Tool } from '../../tools/types.js';
type SearchFn = (query: string, workspace: string, topK: number, filePattern?: string) => Promise<Array<{
    filePath: string;
    chunkStart: number;
    chunkEnd: number;
    chunkText: string;
    similarity: number;
}>>;
/**
 * Initialize the codebase_search tool with the search function from electron layer.
 */
export declare function initCodebaseSearchTool(searchFn: SearchFn): void;
export declare const codebaseSearchTool: Tool;
export {};
//# sourceMappingURL=codebase-search.d.ts.map