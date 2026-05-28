"use strict";
// 灵境 Cloud 远程代理客户端
// CloudAgent client for executing tasks on remote cloud environment
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudAgentClient = void 0;
exports.createCloudAgentTool = createCloudAgentTool;
exports.createCloudAgentStatusTool = createCloudAgentStatusTool;
function toError(err) {
    if (err instanceof Error)
        return err;
    return new Error(typeof err === 'string' ? err : JSON.stringify(err));
}
class CloudAgentClient {
    config;
    sessions = new Map();
    _runningCount = 0;
    constructor(config) {
        this.config = {
            endpoint: config.endpoint,
            apiKey: config.apiKey,
            timeout: config.timeout ?? 300,
            maxConcurrent: config.maxConcurrent ?? 5,
        };
    }
    async _fetch(url, opts = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout * 1000);
        try {
            return await fetch(url, { ...opts, signal: controller.signal });
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async _acquireSlot() {
        while (this._runningCount >= this.config.maxConcurrent) {
            await new Promise(r => setTimeout(r, 100));
        }
        this._runningCount++;
    }
    _releaseSlot() {
        this._runningCount = Math.max(0, this._runningCount - 1);
    }
    async createSession(options) {
        const sessionId = `cloud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        this.sessions.set(sessionId, {
            sessionId,
            status: 'pending',
            metadata: options.context,
        });
        try {
            const response = await this._fetch(`${this.config.endpoint}/api/agent/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
                },
                body: JSON.stringify({
                    sessionId,
                    task: options.task,
                    systemPrompt: options.systemPrompt,
                    tools: options.tools,
                    context: options.context,
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to create cloud session: ${response.statusText}`);
            }
            const data = await response.json();
            const serverSessionId = data.sessionId || sessionId;
            if (serverSessionId !== sessionId) {
                this.sessions.delete(sessionId);
                this.sessions.set(serverSessionId, {
                    sessionId: serverSessionId,
                    status: 'pending',
                    metadata: options.context,
                });
            }
            return serverSessionId;
        }
        catch (err) {
            this.sessions.delete(sessionId);
            throw err;
        }
    }
    async execute(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        await this._acquireSlot();
        session.status = 'running';
        try {
            const response = await this._fetch(`${this.config.endpoint}/api/agent/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
                },
                body: JSON.stringify({ sessionId }),
            });
            if (!response.ok) {
                throw new Error(`Execution failed: ${response.statusText}`);
            }
            const data = await response.json();
            session.status = 'completed';
            session.output = data.output;
            return session;
        }
        catch (err) {
            session.status = 'failed';
            session.error = toError(err).message;
            throw err;
        }
        finally {
            this._releaseSlot();
        }
    }
    async getStatus(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        try {
            const response = await this._fetch(`${this.config.endpoint}/api/agent/status/${sessionId}`, {
                headers: {
                    ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
                },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.status && ['pending', 'running', 'completed', 'failed'].includes(data.status)) {
                    session.status = data.status;
                }
                session.output = data.output;
                session.error = data.error;
            }
        }
        catch (err) {
            console.warn('[CloudAgent] getStatus failed, returning cached state:', toError(err).message);
        }
        return session;
    }
    async cancel(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        try {
            await this._fetch(`${this.config.endpoint}/api/agent/cancel/${sessionId}`, {
                method: 'POST',
                headers: {
                    ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
                },
            });
        }
        catch (err) {
            console.warn('[CloudAgent] cancel request failed:', toError(err).message);
        }
        session.status = 'failed';
        session.error = 'Cancelled by user';
    }
    async listSessions() {
        return Array.from(this.sessions.values());
    }
    async cleanup() {
        this.sessions.clear();
    }
}
exports.CloudAgentClient = CloudAgentClient;
function createCloudAgentTool(client) {
    return {
        name: 'cloud_agent',
        description: 'Execute agent tasks on a remote cloud environment. Useful for resource-intensive tasks or distributed processing.',
        parameters: {
            type: 'object',
            properties: {
                task: {
                    type: 'string',
                    description: 'Task to execute on the cloud agent',
                },
                systemPrompt: {
                    type: 'string',
                    description: 'Custom system prompt for the cloud agent',
                },
                tools: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of tools to enable on the cloud agent',
                },
                context: {
                    type: 'object',
                    description: 'Additional context data for the task',
                },
                wait: {
                    type: 'boolean',
                    description: 'Wait for completion. Default: true',
                },
            },
            required: ['task'],
        },
        async execute(args, context) {
            try {
                const sessionId = await client.createSession({
                    task: args.task,
                    systemPrompt: args.systemPrompt,
                    tools: args.tools,
                    context: args.context,
                });
                const wait = args.wait !== false;
                if (wait) {
                    const result = await client.execute(sessionId);
                    let output = `## Cloud Agent Result\n\n`;
                    output += `- **Session ID**: ${sessionId}\n`;
                    output += `- **Status**: ${result.status}\n\n`;
                    if (result.output) {
                        output += `### Output\n\`\`\`\n${result.output}\n\`\`\`\n`;
                    }
                    if (result.error) {
                        output += `\n### Error\n${result.error}\n`;
                    }
                    return { output, error: result.status === 'failed' };
                }
                else {
                    client.execute(sessionId).catch(err => {
                        console.error('[CloudAgent] Background execute failed:', toError(err).message);
                    });
                    return {
                        output: `Cloud agent task started in background.\n\nSession ID: ${sessionId}\n\nUse \`cloud_agent_status\` tool to check progress.`,
                        error: false,
                    };
                }
            }
            catch (err) {
                return { output: `Cloud agent error: ${toError(err).message}`, error: true };
            }
        },
    };
}
function createCloudAgentStatusTool(client) {
    return {
        name: 'cloud_agent_status',
        description: 'Check the status of a cloud agent session',
        parameters: {
            type: 'object',
            properties: {
                sessionId: {
                    type: 'string',
                    description: 'Session ID to check',
                },
            },
            required: ['sessionId'],
        },
        async execute(args, context) {
            try {
                const result = await client.getStatus(args.sessionId);
                let output = `## Cloud Agent Status\n\n`;
                output += `- **Session ID**: ${result.sessionId}\n`;
                output += `- **Status**: ${result.status}\n`;
                if (result.output) {
                    output += `\n### Output\n\`\`\`\n${result.output}\n\`\`\`\n`;
                }
                if (result.error) {
                    output += `\n### Error\n${result.error}\n`;
                }
                return { output, error: false };
            }
            catch (err) {
                return { output: `Failed to get status: ${toError(err).message}`, error: true };
            }
        },
    };
}
//# sourceMappingURL=remote-agent.js.map