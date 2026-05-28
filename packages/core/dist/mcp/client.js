"use strict";
// MCP Client - manages a single MCP server connection over stdio
// Implements JSON-RPC 2.0 transport
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpClient = void 0;
const node_child_process_1 = require("node:child_process");
const node_events_1 = require("node:events");
const node_path_1 = require("node:path");
const logger_js_1 = require("../utils/logger.js");
const MCP_PROTOCOL_VERSION = '2024-11-05';
class McpClient extends node_events_1.EventEmitter {
    serverName;
    config;
    process = null;
    requestId = 0;
    pending = new Map();
    buffer = '';
    _tools = [];
    _serverInfo = null;
    _connected = false;
    constructor(serverName, config) {
        super();
        this.serverName = serverName;
        this.config = config;
    }
    get name() {
        return this.serverName;
    }
    get connected() {
        return this._connected;
    }
    get tools() {
        return this._tools;
    }
    get serverInfo() {
        return this._serverInfo;
    }
    _stderrBuffer = '';
    async connect() {
        if (this._connected)
            return;
        let { command, args = [], env, cwd } = this.config;
        if (!command) {
            throw new Error('MCP server command is required');
        }
        // On Windows, npx/npm/node are .cmd scripts - ensure they resolve correctly
        const spawnEnv = { ...process.env, ...env };
        // Ensure PATH includes common Node.js locations on Windows
        if (process.platform === 'win32') {
            const nodeDir = process.execPath ? (0, node_path_1.join)(process.execPath, '..') : '';
            const existingPath = spawnEnv.PATH || spawnEnv.Path || '';
            if (nodeDir && !existingPath.toLowerCase().includes(nodeDir.toLowerCase())) {
                spawnEnv.PATH = `${nodeDir};${existingPath}`;
            }
            // Also add common Node.js install paths
            const commonPaths = [
                (0, node_path_1.join)(process.env.APPDATA || '', 'npm'),
                (0, node_path_1.join)(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs'),
                (0, node_path_1.join)(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs'),
            ];
            for (const p of commonPaths) {
                if (p && !existingPath.toLowerCase().includes(p.toLowerCase())) {
                    spawnEnv.PATH = `${p};${spawnEnv.PATH}`;
                }
            }
        }
        logger_js_1.logger.info(`[MCP:${this.serverName}] Spawning: ${command} ${args.join(' ')}`);
        logger_js_1.logger.info(`[MCP:${this.serverName}] Platform: ${process.platform}, cwd: ${cwd || process.cwd()}`);
        // 🔴 Fix: Windows paths with spaces (e.g. C:\Program Files\...) cause shell quoting errors
        //   when shell:true is used unconditionally. Resolve 'node'→process.execPath,
        //   use shell:false for direct exe paths, quote args for bare commands.
        if (process.platform === 'win32') {
            // Resolve bare 'node'/'node.exe' to full path of node.exe
            if (command === 'node' || command === 'node.exe') {
                command = process.execPath;
            }
            // Check if command is a direct executable path (contains \ or /)
            const isDirectExe = command.includes('\\') || command.includes('/');
            if (isDirectExe) {
                // Direct executable — no shell needed, avoids all cmd.exe quoting issues
                this.process = (0, node_child_process_1.spawn)(command, args, {
                    cwd,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: spawnEnv,
                    windowsHide: true,
                    shell: false,
                });
            }
            else {
                // Bare command ('npx', 'npm') — needs cmd.exe for .cmd script resolution
                // Quote args containing spaces to prevent shell from splitting on spaces
                const quotedArgs = args.map(a => a.includes(' ') && !a.startsWith('"') ? `"${a}"` : a);
                this.process = (0, node_child_process_1.spawn)(command, quotedArgs, {
                    cwd,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: spawnEnv,
                    windowsHide: true,
                    shell: true,
                });
            }
        }
        else {
            // Non-Windows: no special handling needed
            this.process = (0, node_child_process_1.spawn)(command, args, {
                cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: spawnEnv,
                windowsHide: true,
            });
        }
        this._stderrBuffer = '';
        this.process.stdout.on('data', (data) => {
            this.handleData(data.toString());
        });
        this.process.stderr.on('data', (data) => {
            const text = data.toString().trim();
            logger_js_1.logger.info(`[MCP:${this.serverName}] stderr: ${text}`);
            // Keep last 1000 chars of stderr for error reporting
            this._stderrBuffer = (this._stderrBuffer + '\n' + text).slice(-1000);
        });
        this.process.on('error', (err) => {
            logger_js_1.logger.error(`[MCP:${this.serverName}] Process error: ${err.message}`);
            this.cleanup(err.message);
        });
        this.process.on('exit', (code) => {
            logger_js_1.logger.error(`[MCP:${this.serverName}] Process exited with code ${code}`);
            const reason = code !== 0
                ? `Process exited with code ${code}${this._stderrBuffer ? ': ' + this._stderrBuffer.trim() : ''}`
                : undefined;
            this.cleanup(reason);
        });
        // Initialize the MCP connection with longer timeout for npx downloads
        const initTimeout = 120000; // 2 minutes for first run (npm install)
        logger_js_1.logger.info(`[MCP:${this.serverName}] Sending initialize request...`);
        const result = await this.request('initialize', {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
                name: '灵境',
                version: '1.0.0',
            },
        }, initTimeout);
        this._serverInfo = result.serverInfo;
        this._connected = true;
        // Send initialized notification
        this.notify('notifications/initialized', {});
        // Fetch available tools
        if (result.capabilities.tools) {
            logger_js_1.logger.info(`[MCP:${this.serverName}] Fetching tools list...`);
            await this.refreshTools();
        }
        logger_js_1.logger.info(`[MCP:${this.serverName}] Connected to ${result.serverInfo.name} v${result.serverInfo.version}, ${this._tools.length} tools available`);
    }
    async refreshTools() {
        const result = await this.request('tools/list', {});
        this._tools = result.tools;
        return this._tools;
    }
    async callTool(name, args) {
        return this.request('tools/call', {
            name,
            arguments: args,
        });
    }
    async disconnect() {
        if (!this._connected)
            return;
        // Try graceful shutdown
        try {
            await Promise.race([
                this.request('shutdown', {}),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
            ]);
            this.notify('exit', {});
        }
        catch {
            // Force kill if graceful shutdown fails
        }
        this.cleanup();
    }
    request(method, params, timeoutMs = 60000) {
        return new Promise((resolve, reject) => {
            if (!this.process?.stdin?.writable) {
                reject(new Error(`MCP server ${this.serverName} is not connected`));
                return;
            }
            const id = ++this.requestId;
            const request = {
                jsonrpc: '2.0',
                id,
                method,
                params,
            };
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`MCP request ${method} timed out after ${timeoutMs / 1000}s`));
            }, timeoutMs);
            this.pending.set(id, {
                resolve: resolve,
                reject,
                timer,
            });
            const message = JSON.stringify(request);
            this.process.stdin.write(`Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
        });
    }
    notify(method, params) {
        if (!this.process?.stdin?.writable)
            return;
        const notification = {
            jsonrpc: '2.0',
            method,
            params,
        };
        const message = JSON.stringify(notification);
        this.process.stdin.write(`Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
    }
    handleData(chunk) {
        // Safety: Max 1000 iterations to prevent infinite loop from malformed data
        let iterations = 0;
        const MAX_ITERATIONS = 1000;
        while (iterations < MAX_ITERATIONS) {
            iterations++;
            // Parse headers
            const headerEnd = this.buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1)
                break;
            const headers = this.buffer.substring(0, headerEnd);
            const contentLengthMatch = headers.match(/Content-Length:\s*(\d+)/i);
            if (!contentLengthMatch) {
                // Malformed header, skip it
                this.buffer = this.buffer.substring(headerEnd + 4);
                continue;
            }
            const contentLength = parseInt(contentLengthMatch[1], 10);
            // Content-Length must be a positive integer (safety guard)
            if (!Number.isFinite(contentLength) || contentLength <= 0) {
                // Invalid Content-Length, skip this message
                this.buffer = this.buffer.substring(headerEnd + 4);
                logger_js_1.logger.warn(`[MCP:${this.serverName}] Invalid Content-Length: ${contentLength}, skipping`);
                continue;
            }
            // Prevent unreasonable message sizes (>10MB)
            if (contentLength > 10 * 1024 * 1024) {
                logger_js_1.logger.error(`[MCP:${this.serverName}] Content-Length too large: ${contentLength}, disconnecting`);
                this.cleanup(`Message too large: ${contentLength} bytes`);
                break;
            }
            const bodyStart = headerEnd + 4;
            if (this.buffer.length < bodyStart + contentLength) {
                // Not enough data yet
                break;
            }
            const body = this.buffer.substring(bodyStart, bodyStart + contentLength);
            this.buffer = this.buffer.substring(bodyStart + contentLength);
            try {
                const message = JSON.parse(body);
                this.handleMessage(message);
            }
            catch (err) {
                logger_js_1.logger.error(`[MCP:${this.serverName}] Failed to parse message: ${body.substring(0, 200)}`);
            }
        }
        if (iterations >= MAX_ITERATIONS) {
            logger_js_1.logger.error(`[MCP:${this.serverName}] handleData exceeded max iterations (${MAX_ITERATIONS}), clearing buffer`);
            this.buffer = '';
        }
    }
    handleMessage(message) {
        // Response to a request
        if ('id' in message && message.id != null) {
            const pending = this.pending.get(message.id);
            if (pending) {
                this.pending.delete(message.id);
                clearTimeout(pending.timer);
                if (message.error) {
                    pending.reject(new Error(`MCP error ${message.error.code}: ${message.error.message}`));
                }
                else {
                    pending.resolve(message.result);
                }
            }
            return;
        }
        // Notification from server
        if ('method' in message) {
            this.emit('notification', message.method, message.params);
        }
    }
    cleanup(reason) {
        this._connected = false;
        // Reject all pending requests
        const errorMsg = reason || 'MCP connection closed';
        for (const [id, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new Error(errorMsg));
        }
        this.pending.clear();
        // Kill process
        if (this.process) {
            try {
                this.process.kill();
            }
            catch { /* already dead */ }
            this.process = null;
        }
    }
}
exports.McpClient = McpClient;
//# sourceMappingURL=client.js.map