import type { JSONSchema } from '../llm/types.js';
export interface ToolResult {
    content: string;
    isError?: boolean;
}
export type ExpertEvent = {
    type: 'expert_dispatch_start';
    taskCount: number;
    tasks: Array<{
        id: string;
        expertType: string;
        title: string;
    }>;
} | {
    type: 'expert_task_start';
    taskId: string;
    expertType: string;
    title: string;
} | {
    type: 'expert_task_progress';
    taskId: string;
    expertType: string;
    text: string;
} | {
    type: 'expert_task_end';
    taskId: string;
    expertType: string;
    title: string;
    result: string;
    isError: boolean;
} | {
    type: 'expert_dispatch_end';
    totalTasks: number;
    succeeded: number;
    failed: number;
};
export interface ToolLifecycle {
    initialize?(): Promise<void>;
    dispose?(): Promise<void>;
}
export interface ToolContext {
    sessionId?: string;
    conversationId?: string;
    workingDirectory: string;
    signal: AbortSignal;
    onProgress?: (text: string) => void;
    askUser?: (question: string) => Promise<string>;
    onExpertEvent?: (event: ExpertEvent) => void;
    sshTerminalId?: string;
    enableSandbox?: boolean;
}
export interface Tool {
    name: string;
    description: string;
    parameters: JSONSchema;
    lifecycle?: ToolLifecycle;
    mcpSource?: string;
    execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
/**
 * Convert a Tool to an MCP-compatible tool schema.
 * Maps parameters to inputSchema as required by the MCP protocol.
 */
export declare function toolToSchema(tool: Tool): {
    name: string;
    description: string;
    inputSchema: JSONSchema;
};
//# sourceMappingURL=types.d.ts.map