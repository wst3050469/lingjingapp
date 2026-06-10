// MCP SSE Client - connects to remote MCP servers via Server-Sent Events

import { EventEmitter } from 'events';
import type {
  McpServerConfig,
  McpServerInfo,
  McpToolDefinition,
  McpToolCallResult,
  JsonRpcResponse,
} from './types.js';
import { logger } from '../utils/logger.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class McpSseClient extends EventEmitter {
  private _name: string;
  private _config: McpServerConfig;
  private _tools: McpToolDefinition[] = [];
  private _serverInfo: McpServerInfo | null = null;
  private _connected = false;
  private _requestId = 0;
  private _eventSource: EventSource | null = null;
  private _pendingRequests = new Map<number, PendingRequest>();
  private _endpointUrl: string | null = null;

  constructor(name: string, config: McpServerConfig) {
    super();
    this._name = name;
    this._config = config;
  }

  get name(): string {
    return this._name;
  }

  get serverInfo(): McpServerInfo | null {
    return this._serverInfo;
  }

  get tools(): McpToolDefinition[] {
    return this._tools;
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
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
    } catch (error) {
      await this.disconnect();
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect MCP SSE client "${this._name}": ${msg}`);
    }
  }

  async disconnect(): Promise<void> {
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

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    if (!this._connected) {
      throw new Error('Not connected to MCP server');
    }

    const timeout = this._config.timeout || 30000;

    return this._sendRequest('tools/call', { name, arguments: args }, timeout) as Promise<McpToolCallResult>;
  }

  async refreshTools(): Promise<McpToolDefinition[]> {
    if (!this._connected) {
      throw new Error('Not connected to MCP server');
    }

    const timeout = this._config.timeout || 30000;
    const result = await this._sendRequest('tools/list', {}, timeout) as any;
    this._tools = result?.tools || [];
    return this._tools;
  }

  private async _connectSSE(timeout: number): Promise<void> {
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
      } catch (error) {
        clearTimeout(connectionTimeout);
        reject(error);
      }
    });
  }

  private async _connectWithFetch(timeout: number): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this._config.url!, {
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
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private _readSSEStream(reader: ReadableStreamDefaultReader<Uint8Array>): void {
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
              const response: JsonRpcResponse = JSON.parse(data);
              this._handleResponse(response);
            } catch (error) {
              logger.error(`[MCP:${this._name}] Failed to parse SSE message:`, error);
            }
          }
        }

        readNext();
      } catch (error) {
        logger.error(`[MCP:${this._name}] SSE stream error:`, error);
      }
    };

    readNext();
  }

  private async _initialize(timeout: number): Promise<void> {
    const result = await this._sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: '灵境',
        version: '1.0.0',
      },
    }, timeout) as any;

    this._serverInfo = result?.serverInfo || { name: this._name, version: 'unknown' };

    // Send initialized notification
    await this._sendNotification('notifications/initialized', {});
  }

  private _sendRequest(method: string, params: Record<string, unknown>, timeout: number): Promise<unknown> {
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

  private _sendNotification(method: string, params: Record<string, unknown>): Promise<void> {
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this._sendToServer(notification);
    return Promise.resolve();
  }

  private _sendToServer(request: any): void {
    const url = this._endpointUrl || this._config.url;
    if (!url) {
      throw new Error('No URL available for SSE client');
    }

    const headers: Record<string, string> = {
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

  private _handleResponse(response: JsonRpcResponse): void {
    if ('id' in response && response.id !== null) {
      const pending = this._pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this._pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    }
  }
}
