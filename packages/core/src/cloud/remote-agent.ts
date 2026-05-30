// 灵境 Cloud 远程代理客户端
// CloudAgent client for executing tasks on remote cloud environment

export interface CloudAgentConfig {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  maxConcurrent?: number;
}

export interface CloudAgentSession {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export class CloudAgentClient {
  config: {
    endpoint: string;
    apiKey?: string;
    timeout: number;
    maxConcurrent: number;
  };
  sessions: Map<string, CloudAgentSession> = new Map();

  constructor(config: CloudAgentConfig) {
    this.config = {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 300,
      maxConcurrent: config.maxConcurrent ?? 5,
    };
  }

  async createSession(options: {
    task: string;
    systemPrompt?: string;
    tools?: string[];
    context?: Record<string, any>;
  }): Promise<string> {
    const sessionId = `cloud-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.sessions.set(sessionId, {
      sessionId,
      status: 'pending',
      metadata: options.context,
    });
    try {
      const response = await fetch(`${this.config.endpoint}/api/agent/create`, {
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
      return data.sessionId || sessionId;
    } catch (err) {
      this.sessions.delete(sessionId);
      throw err;
    }
  }

  async execute(sessionId: string): Promise<CloudAgentSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.status = 'running';
    try {
      const response = await fetch(`${this.config.endpoint}/api/agent/execute`, {
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
    } catch (err) {
      session.status = 'failed';
      session.error = (err as Error).message;
      throw err;
    }
  }

  async getStatus(sessionId: string): Promise<CloudAgentSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    try {
      const response = await fetch(`${this.config.endpoint}/api/agent/status/${sessionId}`, {
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
    } catch {
      // Return cached session state
    }
    return session;
  }

  async cancel(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    try {
      await fetch(`${this.config.endpoint}/api/agent/cancel/${sessionId}`, {
        method: 'POST',
        headers: {
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
      });
    } catch {
      // Ignore cancel errors
    }
    session.status = 'failed';
    session.error = 'Cancelled by user';
  }

  async listSessions(): Promise<CloudAgentSession[]> {
    return Array.from(this.sessions.values());
  }

  async cleanup(): Promise<void> {
    this.sessions.clear();
  }
}

export interface CloudAgentToolArgs {
  task: string;
  systemPrompt?: string;
  tools?: string[];
  context?: Record<string, any>;
  wait?: boolean;
}

export function createCloudAgentTool(client: CloudAgentClient) {
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
    async execute(args: CloudAgentToolArgs, context?: any) {
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
        } else {
          client.execute(sessionId).catch(() => {});
          return {
            output: `Cloud agent task started in background.\n\nSession ID: ${sessionId}\n\nUse \`cloud_agent_status\` tool to check progress.`,
            error: false,
          };
        }
      } catch (err) {
        return { output: `Cloud agent error: ${(err as Error).message}`, error: true };
      }
    },
  };
}

export function createCloudAgentStatusTool(client: CloudAgentClient) {
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
    async execute(args: { sessionId: string }, context?: any) {
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
      } catch (err) {
        return { output: `Failed to get status: ${(err as Error).message}`, error: true };
      }
    },
  };
}
