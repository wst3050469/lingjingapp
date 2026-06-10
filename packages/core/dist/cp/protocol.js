export const CP_METHODS = {
    AGENT_EXECUTE: 'agent/execute',
    AGENT_STATUS: 'agent/status',
    AGENT_CANCEL: 'agent/cancel',
    TOOLS_LIST: 'tools/list',
    TOOLS_CALL: 'tools/call',
    RESOURCES_LIST: 'resources/list',
    RESOURCES_READ: 'resources/read',
    WORKFLOW_START: 'workflow/start',
    WORKFLOW_STATUS: 'workflow/status',
    MEMORY_GET: 'memory/get',
    MEMORY_SET: 'memory/set',
    CONTEXT_SYNC: 'context/sync',
};
export class CPProtocol {
    handlers = new Map();
    connections = new Map();
    messageId = 0;
    registerHandler(method, handler) {
        this.handlers.set(method, { method, handler });
    }
    unregisterHandler(method) {
        this.handlers.delete(method);
    }
    async handleMessage(message, connectionId) {
        if (message.type !== 'request') {
            return null;
        }
        const handler = this.handlers.get(message.method || '');
        if (!handler) {
            return {
                id: message.id,
                type: 'error',
                error: {
                    code: -32601,
                    message: `Method not found: ${message.method}`,
                },
            };
        }
        try {
            const result = await handler.handler(message.params);
            return {
                id: message.id,
                type: 'response',
                result,
            };
        }
        catch (err) {
            return {
                id: message.id,
                type: 'error',
                error: {
                    code: -32000,
                    message: err.message,
                    data: err.stack,
                },
            };
        }
    }
    createRequest(method, params) {
        return {
            id: `${++this.messageId}`,
            type: 'request',
            method,
            params,
        };
    }
    createNotification(method, params) {
        return {
            id: `${++this.messageId}`,
            type: 'notification',
            method,
            params,
        };
    }
    addConnection(connection) {
        this.connections.set(connection.id, connection);
    }
    removeConnection(connectionId) {
        this.connections.delete(connectionId);
    }
    async broadcast(method, params) {
        const notification = this.createNotification(method, params);
        const promises = [];
        for (const connection of this.connections.values()) {
            if (connection.status === 'connected') {
                promises.push(connection.send(notification));
            }
        }
        await Promise.allSettled(promises);
    }
    async sendTo(connectionId, method, params) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Connection not found or not connected: ${connectionId}`);
        }
        const request = this.createRequest(method, params);
        await connection.send(request);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Response timeout'));
            }, 30000);
            const handler = async (message) => {
                if (message.id === request.id) {
                    clearTimeout(timeout);
                    if (message.type === 'response') {
                        resolve(message.result);
                    }
                    else if (message.type === 'error') {
                        reject(new Error(message.error?.message || 'Unknown error'));
                    }
                }
            };
            // Note: In real implementation, we'd register a response listener here
        });
    }
    getConnections() {
        return Array.from(this.connections.values());
    }
    getHandlers() {
        return Array.from(this.handlers.values());
    }
}
export class CPWebSocketConnection {
    id;
    status = 'connecting';
    ws;
    messageHandler;
    constructor(url, id) {
        this.id = id;
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
            this.status = 'connected';
        };
        this.ws.onclose = () => {
            this.status = 'disconnected';
        };
        this.ws.onerror = () => {
            this.status = 'error';
        };
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data.toString());
                this.messageHandler?.(message);
            }
            catch {
                // Ignore parse errors
            }
        };
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    async send(message) {
        if (this.status !== 'connected') {
            throw new Error('Connection not ready');
        }
        this.ws.send(JSON.stringify(message));
    }
    async close() {
        this.ws.close();
        this.status = 'disconnected';
    }
}
export function createCPProtocol() {
    const protocol = new CPProtocol();
    protocol.registerHandler(CP_METHODS.AGENT_EXECUTE, async (params) => {
        return { status: 'started', taskId: `task-${Date.now()}` };
    });
    protocol.registerHandler(CP_METHODS.AGENT_STATUS, async (params) => {
        return { status: 'completed', result: 'Task completed successfully' };
    });
    protocol.registerHandler(CP_METHODS.TOOLS_LIST, async (params) => {
        return { tools: [] };
    });
    protocol.registerHandler(CP_METHODS.MEMORY_GET, async (params) => {
        return { value: null };
    });
    protocol.registerHandler(CP_METHODS.MEMORY_SET, async (params) => {
        return { success: true };
    });
    return protocol;
}
//# sourceMappingURL=protocol.js.map