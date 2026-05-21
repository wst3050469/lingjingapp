export interface CPMessage {
    id: string;
    type: 'request' | 'response' | 'notification' | 'error';
    method?: string;
    params?: any;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export interface CPConnection {
    id: string;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    send(message: CPMessage): Promise<void>;
    close(): Promise<void>;
}
export interface CPHandler {
    method: string;
    handler: (params: any) => Promise<any>;
}
export declare const CP_METHODS: {
    readonly AGENT_EXECUTE: "agent/execute";
    readonly AGENT_STATUS: "agent/status";
    readonly AGENT_CANCEL: "agent/cancel";
    readonly TOOLS_LIST: "tools/list";
    readonly TOOLS_CALL: "tools/call";
    readonly RESOURCES_LIST: "resources/list";
    readonly RESOURCES_READ: "resources/read";
    readonly WORKFLOW_START: "workflow/start";
    readonly WORKFLOW_STATUS: "workflow/status";
    readonly MEMORY_GET: "memory/get";
    readonly MEMORY_SET: "memory/set";
    readonly CONTEXT_SYNC: "context/sync";
};
export declare class CPProtocol {
    private handlers;
    private connections;
    private messageId;
    registerHandler(method: string, handler: (params: any) => Promise<any>): void;
    unregisterHandler(method: string): void;
    handleMessage(message: CPMessage, connectionId: string): Promise<CPMessage | null>;
    createRequest(method: string, params?: any): CPMessage;
    createNotification(method: string, params?: any): CPMessage;
    addConnection(connection: CPConnection): void;
    removeConnection(connectionId: string): void;
    broadcast(method: string, params?: any): Promise<void>;
    sendTo(connectionId: string, method: string, params?: any): Promise<any>;
    getConnections(): CPConnection[];
    getHandlers(): CPHandler[];
}
export declare class CPWebSocketConnection implements CPConnection {
    id: string;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    private ws;
    private messageHandler?;
    constructor(url: string, id: string);
    onMessage(handler: (message: CPMessage) => void): void;
    send(message: CPMessage): Promise<void>;
    close(): Promise<void>;
}
export declare function createCPProtocol(): CPProtocol;
//# sourceMappingURL=protocol.d.ts.map