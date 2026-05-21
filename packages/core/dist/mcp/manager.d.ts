import type { McpServerConfig, McpToolDefinition, McpServerState } from './types.js';
import type { Tool } from '../tools/types.js';
interface McpClientUnion {
    name: string;
    connected: boolean;
    tools: McpToolDefinition[];
    serverInfo?: {
        name: string;
        version: string;
    } | null;
    callTool(name: string, args: Record<string, unknown>): Promise<any>;
    disconnect(): Promise<void>;
}
export interface McpConnectResult {
    success: boolean;
    client?: McpClientUnion;
    error?: string;
    errorCategory?: 'spawn' | 'timeout' | 'protocol' | 'network' | 'validation';
}
export declare class McpManager {
    private clients;
    private serverStates;
    addServer(name: string, config: McpServerConfig): Promise<McpConnectResult>;
    removeServer(name: string): Promise<void>;
    getClient(name: string): McpClientUnion | undefined;
    getConnectedServers(): string[];
    /**
     * Get all MCP tools as CodePilot Tool objects, ready to register in ToolRegistry.
     * Tool names are prefixed with `mcp__<serverName>__` to avoid conflicts.
     */
    getAllTools(): Tool[];
    /**
     * Get tools from a specific server
     */
    getServerTools(serverName: string): Tool[];
    disconnectAll(): Promise<void>;
    getServerStates(): McpServerState[];
    private updateServerState;
}
export {};
//# sourceMappingURL=manager.d.ts.map