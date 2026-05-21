// MCP SSE Client - connects to remote MCP servers via Server-Sent Events
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
export class McpSseClient extends EventEmitter {
    _name;
    _config;
    _tools = [];
    _serverInfo = null;
    _connected = false;
    _requestId = 0;
    _eventSource = null;
    _pendingRequests = new Map();
    _endpointUrl = null;
    constructor(name, config) {
        super();
        this._name = name;
        this._config = config;
    }
    get name() {
        return this._name;
    }
    get serverInfo() {
        return this._serverInfo;
    }
    get tools() {
        return this._tools;
    }
    get connected() {
        return this._connected;
    }
    async connect() {
        if (this._connected) {
            return;
        }
        if (!this._config.url) {
            throw new Error('SSE client requires a URL configuration');
        }
        const timeout = this._config.timeout || 30000;
        try {
            // Step 1: Establish SSE connection
            await this._connectSSE(timeout);
            // Step 2: Initialize MCP
            await this._initialize(timeout);
            // Step 3: Fetch available tools
            await this.refreshTools();
            this._connected = true;
            logger.info(`[MCP:${this._name}] Connected via SSE to ${this._config.url}`);
        }
        catch (error) {
            await this.disconnect();
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to connect MCP SSE client "${this._name}": ${msg}`);
        }
    }
    async disconnect() {
        this._connected = false;
        // Close EventSource
        if (this._eventSource) {
            this._eventSource.close();
            this._eventSource = null;
        }
        // Reject all pending requests
        for (const [, pending] of this._pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Connection closed'));
        }
        this._pendingRequests.clear();
        this._tools = [];
        this._endpointUrl = null;
        logger.info(`[MCP:${this._name}] Disconnected`);
    }
    async callTool(name, args) {
        if (!this._connected) {
            throw new Error('Not connected to MCP server');
        }
        const timeout = this._config.timeout || 30000;
        return this._sendRequest('tools/call', { name, arguments: args }, timeout);
    }
    async refreshTools() {
        if (!this._connected) {
            throw new Error('Not connected to MCP server');
        }
        const timeout = this._config.timeout || 30000;
        const result = await this._sendRequest('tools/list', {}, timeout);
        this._tools = result?.tools || [];
        return this._tools;
    }
    async _connectSSE(timeout) {
        return new Promise((resolve, reject) => {
            const connectionTimeout = setTimeout(() => {
                reject(new Error('SSE connection timeout'));
            }, timeout);
            try {
                // For SSE with custom headers, we need to use a polyfill or native approach
                // Since browser EventSource doesn't support headers, we'll use fetch with ReadableStream
                this._connectWithFetch(timeout)
                    .then(resolve)
                    .catch(reject);
            }
            catch (error) {
                clearTimeout(connectionTimeout);
                reject(error);
            }
        });
    }
    async _connectWithFetch(timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(this._config.url, {
                method: 'GET',
                headers: {
                    'Accept': 'text/event-stream',
                    ...this._config.headers,
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`SSE connection failed with status ${response.status}`);
            }
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Response body is not readable');
            }
            // Extract endpoint URL from response (if different)
            const finalUrl = response.url;
            if (finalUrl !== this._config.url) {
                this._endpointUrl = finalUrl;
            }
            // Start reading SSE stream
            this._readSSEStream(reader);
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    _readSSEStream(reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        const readNext = async () => {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    logger.debug(`[MCP:${this._name}] SSE stream ended`);
                    return;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        try {
                            const response = JSON.parse(data);
                            this._handleResponse(response);
                        }
                        catch (error) {
                            logger.error(`[MCP:${this._name}] Failed to parse SSE message:`, error);
                        }
                    }
                }
                readNext();
            }
            catch (error) {
                logger.error(`[MCP:${this._name}] SSE stream error:`, error);
            }
        };
        readNext();
    }
    async _initialize(timeout) {
        const result = await this._sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: '灵境',
                version: '1.0.0',
            },
        }, timeout);
        this._serverInfo = result?.serverInfo || { name: this._name, version: 'unknown' };
        // Send initialized notification
        await this._sendNotification('notifications/initialized', {});
    }
    _sendRequest(method, params, timeout) {
        const id = ++this._requestId;
        return new Promise((resolve, reject) => {
            const requestTimeout = setTimeout(() => {
                this._pendingRequests.delete(id);
                reject(new Error(`Request "${method}" timeout after ${timeout}ms`));
            }, timeout);
            this._pendingRequests.set(id, { resolve, reject, timeout: requestTimeout });
            const request = {
                jsonrpc: '2.0',
                id,
                method,
                params,
            };
            this._sendToServer(request);
        });
    }
    _sendNotification(method, params) {
        const notification = {
            jsonrpc: '2.0',
            method,
            params,
        };
        this._sendToServer(notification);
        return Promise.resolve();
    }
    _sendToServer(request) {
        const url = this._endpointUrl || this._config.url;
        if (!url) {
            throw new Error('No URL available for SSE client');
        }
        const headers = {
            'Content-Type': 'application/json',
            ...this._config.headers,
        };
        fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(this._config.timeout || 30000),
        }).catch((error) => {
            logger.error(`[MCP:${this._name}] Failed to send request:`, error);
        });
    }
    _handleResponse(response) {
        if ('id' in response && response.id !== null) {
            const pending = this._pendingRequests.get(response.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this._pendingRequests.delete(response.id);
                if (response.error) {
                    pending.reject(new Error(response.error.message));
                }
                else {
                    pending.resolve(response.result);
                }
            }
        }
    }
}
//# sourceMappingURL=sse-client.js.map