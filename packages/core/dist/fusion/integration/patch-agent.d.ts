import type { IHookRegistry } from '../hook-registry/types.js';
import type { IEventBus } from '../event-bus/types.js';
export interface AgentContext {
    sessionId?: string;
    conversationId?: string;
    prompt?: string;
    model?: string;
    [key: string]: unknown;
}
export interface LLMResponseContext extends AgentContext {
    responseContent?: string;
    toolCalls?: Array<{ name: string; arguments: unknown }>;
    usage?: { promptTokens: number; completionTokens: number };
    durationMs?: number;
}
export interface ToolExecutionContext extends AgentContext {
    toolName: string;
    toolArgs: unknown;
}
export interface ToolResultContext extends AgentContext {
    toolName: string;
    toolArgs: unknown;
    toolResult: unknown;
    durationMs?: number;
    success: boolean;
}
export interface SkillContext extends AgentContext {
    skillName: string;
    skillPath?: string;
}
export interface MemoryWriteContext extends AgentContext {
    key: string;
    value: string;
    scope?: string;
}
export interface CompactionContext extends AgentContext {
    originalTokenCount: number;
    compactedTokenCount: number;
    compressionRatio: number;
}
export interface AgentHookPointers {
    beforeRun: (agent: unknown, prompt: string) => Promise<void>;
    afterLLMResponse: (agent: unknown, response: LLMResponseContext) => Promise<void>;
    beforeToolExecute: (agent: unknown, ctx: ToolExecutionContext) => Promise<ToolExecutionContext>;
    afterToolExecute: (agent: unknown, ctx: ToolResultContext) => Promise<void>;
    beforeSkillLoad: (agent: unknown, ctx: SkillContext) => Promise<void>;
    afterSkillLoad: (agent: unknown, ctx: SkillContext) => Promise<void>;
    beforeMemoryWrite: (agent: unknown, ctx: MemoryWriteContext) => Promise<void>;
    afterCompaction: (agent: unknown, ctx: CompactionContext) => Promise<void>;
}
export declare function patchAgentHooks(hookRegistry: IHookRegistry | null, eventBus: IEventBus | null): AgentHookPointers;
