"use strict";
// MCP Manager - manages multiple MCP server connections and bridges tools to ToolRegistry
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpManager = void 0;
const client_js_1 = require("./client.js");
const sse_client_js_1 = require("./sse-client.js");
const logger_js_1 = require("../utils/logger.js");
function classifyMcpError(err) {
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
class McpManager {
    clients = new Map();
    serverStates = new Map();
    async addServer(name, config) {
        if (this.clients.has(name)) {
            await this.removeServer(name);
        }
        this.updateServerState(name, config, 'connecting');
        let client;
        try {
            if (config.type === 'sse' || config.url) {
                const sseClient = new sse_client_js_1.McpSseClient(name, config);
                await sseClient.connect();
                client = sseClient;
                logger_js_1.logger.info(`[MCP:${name}] Connected via ${config.type || 'sse'} to ${config.url}`);
            }
            else {
                const stdioClient = new client_js_1.McpClient(name, config);
                await stdioClient.connect();
                client = stdioClient;
                logger_js_1.logger.info(`[MCP:${name}] Connected via STDIO`);
            }
            this.clients.set(name, client);
            this.updateServerState(name, config, 'connected', client.serverInfo, client.tools);
            return { success: true, client };
        }
        catch (err) {
            const classified = classifyMcpError(err instanceof Error ? err : new Error(String(err)));
            this.updateServerState(name, config, 'connect-failed', undefined, undefined, classified.error, classified.errorCategory);
            logger_js_1.logger.error(`[MCP:${name}] Connection failed: ${classified.error}`);
            return { success: false, error: classified.error, errorCategory: classified.errorCategory };
        }
    }
    async removeServer(name) {
        const client = this.clients.get(name);
        if (client) {
            await client.disconnect();
            this.clients.delete(name);
        }
    }
    getClient(name) {
        return this.clients.get(name);
    }
    getConnectedServers() {
        return Array.from(this.clients.entries())
            .filter(([, client]) => client.connected)
            .map(([name]) => name);
    }
    /**
     * Get all MCP tools as CodePilot Tool objects, ready to register in ToolRegistry.
     * Tool names are prefixed with `mcp__<serverName>__` to avoid conflicts.
     */
    getAllTools() {
        const tools = [];
        for (const [serverName, client] of this.clients) {
            if (!client.connected)
                continue;
            for (const mcpTool of client.tools) {
                tools.push(createMcpToolAdapter(serverName, mcpTool, client));
            }
        }
        return tools;
    }
    /**
     * Get tools from a specific server
     */
    getServerTools(serverName) {
        const client = this.clients.get(serverName);
        if (!client?.connected)
            return [];
        return client.tools.map((t) => createMcpToolAdapter(serverName, t, client));
    }
    async disconnectAll() {
        const promises = Array.from(this.clients.values()).map((c) => c.disconnect());
        await Promise.allSettled(promises);
        this.clients.clear();
        this.serverStates.clear();
    }
    getServerStates() {
        return Array.from(this.serverStates.values());
    }
    updateServerState(name, config, state, serverInfo, tools, error, errorCategory) {
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
exports.McpManager = McpManager;
/**
 * Converts an MCP tool definition into a CodePilot Tool object.
 * The resulting tool delegates execution to the MCP server via the client.
 */
function createMcpToolAdapter(serverName, mcpTool, client) {
    const toolName = `mcp__${serverName}__${mcpTool.name}`;
    const toolTimeout = 60000;
    return {
        name: toolName,
        description: mcpTool.description || `MCP tool: ${mcpTool.name} from ${serverName}`,
        parameters: mcpTool.inputSchema,
        async execute(params, _context) {
            const startTime = Date.now();
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), toolTimeout);
                const result = await Promise.race([
                    client.callTool(mcpTool.name, params),
                    new Promise((_, reject) => {
                        controller.signal.addEventListener('abort', () => {
                            reject(new Error(`MCP工具调用超时 (${toolTimeout / 1000}s): ${mcpTool.name}`));
                        });
                    }),
                ]);
                clearTimeout(timeoutId);
                const text = result.content
                    .filter((c) => c.type === 'text' && c.text)
                    .map((c) => c.text)
                    .join('\n');
                if (result.isError) {
                    logger_js_1.logger.warn(`[MCP:${serverName}] Tool ${mcpTool.name} returned error: ${text}`);
                }
                return {
                    content: text || '(no output)',
                    isError: result.isError ?? false,
                };
            }
            catch (err) {
                const durationMs = Date.now() - startTime;
                const message = err instanceof Error ? err.message : String(err);
                logger_js_1.logger.error(`[MCP:${serverName}] Tool ${mcpTool.name} failed (${durationMs}ms): ${message}`);
                return {
                    content: `MCP工具错误: ${message}`,
                    isError: true,
                };
            }
        },
    };
}
//# sourceMappingURL=manager.js.map