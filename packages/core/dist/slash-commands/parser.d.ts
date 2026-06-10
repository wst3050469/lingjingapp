import type { SlashCommand, CommandCompletion } from './types.js';
export declare class SlashCommandParser {
    private commands;
    private commandPrefix;
    register(command: SlashCommand): void;
    unregister(name: string): boolean;
    get(name: string): SlashCommand | undefined;
    getAll(): SlashCommand[];
    parse(input: string): {
        isCommand: boolean;
        command?: string;
        args?: string;
    };
    getCompletions(partial: string): CommandCompletion[];
    execute(input: string, context: any): Promise<{
        success: boolean;
        message: string;
        data?: unknown;
    }>;
    private findSimilar;
    getHelp(): string;
}
//# sourceMappingURL=parser.d.ts.map