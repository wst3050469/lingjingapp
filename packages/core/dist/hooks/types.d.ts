export type HookEventType = 'onFileChange' | 'onFileCreate' | 'onFileDelete' | 'onAgentStart' | 'onAgentEnd' | 'onToolUse' | 'onCommandExecute' | 'onCheckpointCreate' | 'onCheckpointRestore';
export interface HookContext {
    workingDirectory: string;
    timestamp: Date;
    [key: string]: unknown;
}
export interface FileHookContext extends HookContext {
    filePath: string;
    content?: string;
    oldContent?: string;
}
export interface AgentHookContext extends HookContext {
    agentType: string;
    taskId: string;
    input?: string;
    output?: string;
    success?: boolean;
    error?: string;
}
export interface ToolHookContext extends HookContext {
    toolName: string;
    parameters: Record<string, unknown>;
    result?: unknown;
    success?: boolean;
    error?: string;
}
export interface CommandHookContext extends HookContext {
    command: string;
    args: string;
    result?: unknown;
    success?: boolean;
    error?: string;
}
export interface HookHandler {
    (context: any): Promise<void> | void;
}
export interface HookDefinition {
    name: string;
    event: HookEventType;
    handler: HookHandler;
    priority?: number;
    enabled?: boolean;
}
export interface HooksConfig {
    hooks: HookDefinition[];
}
//# sourceMappingURL=types.d.ts.map