import type { LLMProvider } from '../llm/types.js';
import { Conversation } from './conversation.js';
import { ToolExecutor } from '../tools/executor.js';
import { ToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';
import type { AgentEvent } from './agent.js';
import { StructuredError } from '../errors/index.js';
export interface AgentCoreConfig {
    provider: LLMProvider;
    tools: ToolRegistry;
    executor: ToolExecutor;
    systemPrompt: string;
    maxTurns: number;
    maxDuration: number;
    turnTimeout: number;
    maxContextTokens: number;
    maxResponseTokens: number;
    temperature: number;
    workingDirectory: string;
    onEvent?: (event: AgentEvent) => void;
    askUser?: (question: string) => Promise<string>;
    sshTerminalId?: string;
    enableSandbox?: boolean;
}
export declare class AgentCore {
    conversation: Conversation;
    private config;
    private runStartedAt;
    constructor(config: AgentCoreConfig);
    emit(event: AgentEvent): void;
    getProvider(): LLMProvider;
    getTools(): ToolRegistry;
    getExecutor(): ToolExecutor;
    getWorkingDirectory(): string;
    createToolContext(signal: AbortSignal, extra?: Partial<ToolContext>): ToolContext;
    startTimer(): void;
    getElapsedMs(): number;
    isTimedOut(): boolean;
    getConfig(): AgentCoreConfig;
    wrapError(error: unknown, context?: Record<string, unknown>): StructuredError;
}
//# sourceMappingURL=agent-core.d.ts.map