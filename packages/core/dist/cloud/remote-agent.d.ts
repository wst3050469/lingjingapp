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
export declare class CloudAgentClient {
    config: {
        endpoint: string;
        apiKey?: string;
        timeout: number;
        maxConcurrent: number;
    };
    sessions: Map<string, CloudAgentSession>;
    private _runningCount;
    constructor(config: CloudAgentConfig);
    private _fetch;
    private _acquireSlot;
    private _releaseSlot;
    createSession(options: {
        task: string;
        systemPrompt?: string;
        tools?: string[];
        context?: Record<string, any>;
    }): Promise<string>;
    execute(sessionId: string): Promise<CloudAgentSession>;
    getStatus(sessionId: string): Promise<CloudAgentSession>;
    cancel(sessionId: string): Promise<void>;
    listSessions(): Promise<CloudAgentSession[]>;
    cleanup(): Promise<void>;
}
export interface CloudAgentToolArgs {
    task: string;
    systemPrompt?: string;
    tools?: string[];
    context?: Record<string, any>;
    wait?: boolean;
}
export declare function createCloudAgentTool(client: CloudAgentClient): {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            task: {
                type: string;
                description: string;
            };
            systemPrompt: {
                type: string;
                description: string;
            };
            tools: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            context: {
                type: string;
                description: string;
            };
            wait: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: CloudAgentToolArgs, context?: any): Promise<{
        output: string;
        error: boolean;
    }>;
};
export declare function createCloudAgentStatusTool(client: CloudAgentClient): {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            sessionId: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: {
        sessionId: string;
    }, context?: any): Promise<{
        output: string;
        error: boolean;
    }>;
};
//# sourceMappingURL=remote-agent.d.ts.map