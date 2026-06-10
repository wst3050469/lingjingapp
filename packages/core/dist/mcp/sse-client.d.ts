import { EventEmitter } from 'events';
import type { McpServerConfig, McpServerInfo, McpToolDefinition, McpToolCallResult } from './types.js';
export declare class McpSseClient extends EventEmitter {
    private _name;
    private _config;
    private _tools;
    private _serverInfo;
    private _connected;
    private _requestId;
    private _eventSource;
    private _pendingRequests;
    private _endpointUrl;
    constructor(name: string, config: McpServerConfig);
    get name(): string;
    get serverInfo(): McpServerInfo | null;
    get tools(): McpToolDefinition[];
    get connected(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
    refreshTools(): Promise<McpToolDefinition[]>;
    private _connectSSE;
    private _connectWithFetch;
    private _readSSEStream;
    private _initialize;
    private _sendRequest;
    private _sendNotification;
    private _sendToServer;
    private _handleResponse;
}
//# sourceMappingURL=sse-client.d.ts.map