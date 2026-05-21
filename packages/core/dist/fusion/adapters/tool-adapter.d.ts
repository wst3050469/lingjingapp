import { IToolAdapter, IToolRegistry, Tool } from './types.js';
export declare class ToolAdapter implements IToolAdapter {
    readonly version = "1.0.0";
    private registry;
    setRegistry(registry: IToolRegistry): void;
    register(tool: Tool, mcpServerName?: string): void;
    get(name: string): Tool | undefined;
    has(name: string): boolean;
    getAll(): Tool[];
}
export declare function createToolAdapter(registry?: IToolRegistry): ToolAdapter;
//# sourceMappingURL=tool-adapter.d.ts.map