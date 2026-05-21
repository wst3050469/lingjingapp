import { EventEmitter } from 'node:events';
import type { McpToolDefinition, McpToolCallResult, McpServerConfig } from './types.js';
export declare class McpClient extends EventEmitter {
    private serverName;
    private config;
    private process;
    private requestId;
    private pending;
    private buffer;
    private _tools;
    private _serverInfo;
    private _connected;
    constructor(serverName: string, config: McpServerConfig);
    get name(): string;
    get connected(): boolean;
    get tools(): McpToolDefinition[];
    get serverInfo(): {
        name: string;
        version: string;
    } | null;
    private _stderrBuffer;
    connect(): Promise<void>;
    refreshTools(): Promise<McpToolDefinition[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
    disconnect(): Promise<void>;
    private request;
    private notify;
    private handleData;
    private handleMessage;
    private cleanup;
}
//# sourceMappingURL=client.d.ts.map