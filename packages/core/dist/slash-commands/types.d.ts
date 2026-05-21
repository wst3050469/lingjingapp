export interface SlashCommand {
    name: string;
    description: string;
    usage: string;
    examples?: string[];
    parameters?: CommandParameter[];
    execute: (args: string, context: CommandContext) => Promise<CommandResult>;
}
export interface CommandParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'file' | 'directory';
    required: boolean;
    description: string;
    default?: unknown;
}
export interface CommandContext {
    workingDirectory: string;
    signal?: AbortSignal;
    onProgress?: (text: string) => void;
    provider?: any;
    registry?: any;
}
export interface CommandResult {
    success: boolean;
    message: string;
    data?: unknown;
    error?: string;
}
export interface CommandCompletion {
    command: string;
    description: string;
    usage: string;
    match: string;
}
//# sourceMappingURL=types.d.ts.map