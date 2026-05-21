import type { Tool } from '../../tools/types.js';
type GetDiagnosticsFn = (filePath: string | undefined, workspace: string, severity?: string) => Promise<string>;
/**
 * Initialize the get_problems tool with the diagnostics function from electron layer.
 */
export declare function initGetProblemsTool(getDiagnosticsFn: GetDiagnosticsFn): void;
export declare const getProblemsTool: Tool;
export {};
//# sourceMappingURL=get-problems.d.ts.map