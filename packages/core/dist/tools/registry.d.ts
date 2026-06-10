import type { Tool } from './types.js';
import type { ToolSchema } from '../llm/types.js';
export declare class ToolRegistry {
    private tools;
    private mcpSourceMap;
    private initializedSet;
    register(tool: Tool, mcpServerName?: string): void;
    get(name: string): Tool | undefined;
    has(name: string): boolean;
    getAll(): Tool[];
    getSchemas(): ToolSchema[];
    getSubset(names: string[]): ToolRegistry;
    remove(name: string): boolean;
    unregisterByMcpServer(mcpServerName: string): number;
    getMcpSource(toolName: string): string | undefined;
    getByMcpServer(mcpServerName: string): Tool[];
    initializeTool(name: string): Promise<void>;
    disposeTool(name: string): Promise<void>;
    disposeAll(): Promise<void>;
    get size(): number;
}
//# sourceMappingURL=registry.d.ts.map