// MCP Manager - manages multiple MCP server connections and bridges tools to ToolRegistry

import { McpClient } from './client.js';
import { McpSseClient } from './sse-client.js';
import type { McpServerConfig, McpToolDefinition, McpServerState, McpConnectionState } from './types.js';
import type { Tool, ToolContext, ToolResult } from '../tools/types.js';
import type { JSONSchema } from '../llm/types.js';
import { logger } from '../utils/logger.js';

interface McpClientUnion {
  name: string;
  connected: boolean;
  tools: McpToolDefinition[];
  serverInfo?: { name: string; version: string } | null;
  callTool(name: string, args: Record<string, unknown>): Promise<any>;
  disconnect(): Promise<void>;
}

export interface McpConnectResult {
  success: boolean;
  client?: McpClientUnion;
  error?: string;
  errorCategory?: 'spawn' | 'timeout' | 'protocol' | 'network' | 'validation';
}

function classifyMcpError(err: Error): { errorCategory: McpConnectResult['errorCategory']; error: string } {
  const msg = err.message.toLowerCase();
  if (msg.includes('spawn') || msg.includes('enoent') || msg.includes('command not found') || msg.includes('process exited')) {
    return { errorCategory: 'spawn', error: `进程启动失败: ${err.message}` };
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return { errorCategory: 'timeout', error: `连接超时: ${err.message}` };
  }
  if (msg.includes('handshake') || msg.includes('initialize') || msg.includes('protocol')) {
    return { errorCategory: 'protocol', error: `协议握手失败: ${err.message}` };
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('status')) {
    return { errorCategory: 'network', error: `网络连接失败: ${err.message}` };
  }
  return { errorCategory: 'network', error: err.message };
}

export class McpManager {
  private clients = new Map<string, McpClientUnion>();
  private serverStates = new Map<string, McpServerState>();

  async addServer(name: string, config: McpServerConfig): Promise<McpConnectResult> {
    if (this.clients.has(name)) {
      await this.removeServer(name);
    }

    this.updateServerState(name, config, 'connecting');

    let client: McpClientUnion;

    try {
      if (config.type === 'sse' || config.url) {
        const sseClient = new McpSseClient(name, config);
        await sseClient.connect();
        client = sseClient as McpClientUnion;
        logger.info(`[MCP:${name}] Connected via ${config.type || 'sse'} to ${config.url}`);
      } else {
        const stdioClient = new McpClient(name, config);
        await stdioClient.connect();
        client = stdioClient;
        logger.info(`[MCP:${name}] Connected via STDIO`);
      }

      this.clients.set(name, client);
      this.updateServerState(name, config, 'connected', client.serverInfo, client.tools);
      return { success: true, client };
    } catch (err) {
      const classified = classifyMcpError(err instanceof Error ? err : new Error(String(err)));
      this.updateServerState(name, config, 'connect-failed', undefined, undefined, classified.error, classified.errorCategory);
      logger.error(`[MCP:${name}] Connection failed: ${classified.error}`);
      return { success: false, error: classified.error, errorCategory: classified.errorCategory };
    }
  }

  async removeServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  getClient(name: string): McpClientUnion | undefined {
    return this.clients.get(name);
  }

  getConnectedServers(): string[] {
    return Array.from(this.clients.entries())
      .filter(([, client]) => client.connected)
      .map(([name]) => name);
  }

  /**
   * Get all MCP tools as CodePilot Tool objects, ready to register in ToolRegistry.
   * Tool names are prefixed with `mcp__<serverName>__` to avoid conflicts.
   */
  getAllTools(): Tool[] {
    const tools: Tool[] = [];
    for (const [serverName, client] of this.clients) {
      if (!client.connected) continue;
      for (const mcpTool of client.tools) {
        tools.push(createMcpToolAdapter(serverName, mcpTool, client));
      }
    }
    return tools;
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverName: string): Tool[] {
    const client = this.clients.get(serverName);
    if (!client?.connected) return [];
    return client.tools.map((t) => createMcpToolAdapter(serverName, t, client));
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map((c: McpClientUnion) => c.disconnect());
    await Promise.allSettled(promises);
    this.clients.clear();
    this.serverStates.clear();
  }

  getServerStates(): McpServerState[] {
    return Array.from(this.serverStates.values());
  }

  private updateServerState(
    name: string,
    config: McpServerConfig,
    state: McpConnectionState,
    serverInfo?: { name: string; version: string } | null,
    tools?: McpToolDefinition[],
    error?: string,
    errorCategory?: string,
  ): void {
    this.serverStates.set(name, {
      name,
      config,
      state,
      serverInfo: serverInfo ?? undefined,
      tools: tools ?? [],
      error,
      errorCategory,
    });
  }
}

/**
 * Converts an MCP tool definition into a CodePilot Tool object.
 * The resulting tool delegates execution to the MCP server via the client.
 */
function createMcpToolAdapter(
  serverName: string,
  mcpTool: McpToolDefinition,
  client: McpClientUnion,
): Tool {
  const toolName = `mcp__${serverName}__${mcpTool.name}`;
  const toolTimeout = 60000;

  return {
    name: toolName,
    description: mcpTool.description || `MCP tool: ${mcpTool.name} from ${serverName}`,
    parameters: mcpTool.inputSchema as JSONSchema,
    async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), toolTimeout);

        const result = await Promise.race([
          client.callTool(mcpTool.name, params),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error(`MCP工具调用超时 (${toolTimeout / 1000}s): ${mcpTool.name}`));
            });
          }),
        ]);

        clearTimeout(timeoutId);

        const text = result.content
          .filter((c: { type: string; text?: string }) => c.type === 'text' && c.text)
          .map((c: { text?: string }) => c.text!)
          .join('\n');

        if (result.isError) {
          logger.warn(`[MCP:${serverName}] Tool ${mcpTool.name} returned error: ${text}`);
        }

        return {
          content: text || '(no output)',
          isError: result.isError ?? false,
        };
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[MCP:${serverName}] Tool ${mcpTool.name} failed (${durationMs}ms): ${message}`);
        return {
          content: `MCP工具错误: ${message}`,
          isError: true,
        };
      }
    },
  };
}
