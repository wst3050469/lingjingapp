/**
 * Agent Loop Hook Injection Patch
 *
 * INJECTION TARGET: packages/core/src/agent/agent.ts (or agent-core.ts)
 * INJECTION POINT: At key lifecycle points in the agent run loop
 *
 * This patch defines hook and event bus injection points for the agent execution
 * lifecycle. Each function should be called at the corresponding point in the
 * agent's run loop to enable Fusion subsystem observability and extensibility.
 *
 * USAGE: Call these functions at the corresponding lifecycle points in the
 * agent's run() method. The agent does not need to import Fusion directly —
 * these are called by the integration layer.
 *
 * Example injection pattern in agent.ts:
 *
 *   import { patchAgentHooks } from '@codepilot/core/fusion/integration/patch-agent.js';
 *
 *   class Agent {
 *     private agentHooks = patchAgentHooks(hookRegistry, eventBus);
 *
 *     async run(prompt: string) {
 *       await this.agentHooks.beforeRun(this, prompt);
 *       // ... existing code ...
 *       await this.agentHooks.afterLLMResponse(this, response);
 *       // ... etc
 *     }
 *   }
 */
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
    toolCalls?: Array<{
        name: string;
        arguments: unknown;
    }>;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
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
//# sourceMappingURL=patch-agent.d.ts.map