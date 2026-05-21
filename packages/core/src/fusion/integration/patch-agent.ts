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

import { HookPoint } from '../hook-registry/types.js';
import type { IHookRegistry, HookContext } from '../hook-registry/types.js';
import type { IEventBus } from '../event-bus/types.js';
import { logger } from '../../utils/logger.js';

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

export function patchAgentHooks(
  hookRegistry: IHookRegistry | null,
  eventBus: IEventBus | null,
): AgentHookPointers {
  return {
    async beforeRun(agent: unknown, prompt: string): Promise<void> {
      const agentCtx = extractAgentContext(agent);
      try {
        if (hookRegistry) {
          await hookRegistry.execute(HookPoint.BEFORE_LLM_CALL, {
            ...agentCtx,
            prompt,
          });
        }
      } catch (err) {
        logger.warn(`[Fusion:Agent] BEFORE_LLM_CALL hook error: ${(err as Error).message}`);
      }
      if (eventBus) {
        eventBus.publish('agent:message_start', {
          ...agentCtx,
          prompt,
          timestamp: Date.now(),
        }, 'agent-hooks');
      }
    },

    async afterLLMResponse(agent: unknown, response: LLMResponseContext): Promise<void> {
      const agentCtx = extractAgentContext(agent);
      try {
        if (hookRegistry) {
          await hookRegistry.execute(HookPoint.AFTER_LLM_CALL, {
            ...agentCtx,
            ...response,
          });
        }
      } catch (err) {
        logger.warn(`[Fusion:Agent] AFTER_LLM_CALL hook error: ${(err as Error).message}`);
      }
      if (eventBus) {
        eventBus.publish('agent:message_end', {
          ...agentCtx,
          model: response.model,
          usage: response.usage,
          durationMs: response.durationMs,
        }, 'agent-hooks');
      }
    },

    async beforeToolExecute(agent: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionContext> {
      const agentCtx = extractAgentContext(agent);
      try {
        if (hookRegistry) {
          const result = await hookRegistry.execute(HookPoint.BEFORE_TOOL_EXECUTE, {
            ...agentCtx,
            ...ctx,
          });
          return { ...ctx, ...(result.data as Partial<ToolExecutionContext>) };
        }
      } catch (err) {
        logger.warn(`[Fusion:Agent] BEFORE_TOOL_EXECUTE hook error: ${(err as Error).message}`);
      }
      if (eventBus) {
        eventBus.publish('agent:tool_call', {
          ...agentCtx,
          toolName: ctx.toolName,
          toolArgs: ctx.toolArgs,
        }, 'agent-hooks');
      }
      return ctx;
    },

    async afterToolExecute(agent: unknown, ctx: ToolResultContext): Promise<void> {
      const agentCtx = extractAgentContext(agent);
      try {
        if (hookRegistry) {
          await hookRegistry.execute(HookPoint.AFTER_TOOL_EXECUTE, {
            ...agentCtx,
            ...ctx,
          });
        }
      } catch (err) {
        logger.warn(`[Fusion:Agent] AFTER_TOOL_EXECUTE hook error: ${(err as Error).message}`);
      }
      if (eventBus) {
        eventBus.publish('agent:tool_result', {
          ...agentCtx,
          toolName: ctx.toolName,
          success: ctx.success,
          durationMs: ctx.durationMs,
        }, 'agent-hooks');
      }
    },

    async beforeSkillLoad(agent: unknown, ctx: SkillContext): Promise<void> {
      const agentCtx = extractAgentContext(agent);
      try {
        if (hookRegistry) {
          await hookRegistry.execute(HookPoint.BEFORE_SKILL_LOAD, {
            ...agentCtx,
            ...ctx,
          });
        }
      } catch (err) {
        logger.warn(`[Fusion:Agent] BEFORE_SKILL_LOAD hook error: ${(err as Error).message}`);
      }
    },

    async afterSkillLoad(agent: unknown, ctx: SkillContext): Promise<void> {
      const agentCtx = extractAgentContext(agent);
      try {
        if (hookRegistry) {
          await hookRegistry.execute(HookPoint.AFTER_SKILL_LOAD, {
            ...agentCtx,
            ...ctx,
          });
        }
      } catch (err) {
        logger.warn(`[Fusion:Agent] AFTER_SKILL_LOAD hook error: ${(err as Error).message}`);
      }
      if (eventBus) {
        eventBus.publish('skill:loaded', {
          ...agentCtx,
          skillName: ctx.skillName,
        }, 'agent-hooks');
      }
    },

    async beforeMemoryWrite(agent: unknown, ctx: MemoryWriteContext): Promise<void> {
      const agentCtx = extractAgentContext(agent);
      try {
        if (hookRegistry) {
          await hookRegistry.execute(HookPoint.BEFORE_MEMORY_WRITE, {
            ...agentCtx,
            ...ctx,
          });
        }
      } catch (err) {
        logger.warn(`[Fusion:Agent] BEFORE_MEMORY_WRITE hook error: ${(err as Error).message}`);
      }
    },

    async afterCompaction(agent: unknown, ctx: CompactionContext): Promise<void> {
      const agentCtx = extractAgentContext(agent);
      try {
        if (hookRegistry) {
          await hookRegistry.execute(HookPoint.AFTER_COMPACTION, {
            ...agentCtx,
            ...ctx,
          });
        }
      } catch (err) {
        logger.warn(`[Fusion:Agent] AFTER_COMPACTION hook error: ${(err as Error).message}`);
      }
      if (eventBus) {
        eventBus.publish('agent:compaction', {
          ...agentCtx,
          originalTokenCount: ctx.originalTokenCount,
          compactedTokenCount: ctx.compactedTokenCount,
          compressionRatio: ctx.compressionRatio,
        }, 'agent-hooks');
      }
    },
  };
}

function extractAgentContext(agent: unknown): AgentContext {
  if (agent && typeof agent === 'object') {
    const obj = agent as Record<string, unknown>;
    return {
      sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : undefined,
      conversationId: typeof obj.conversationId === 'string' ? obj.conversationId : undefined,
      model: typeof obj.model === 'string' ? obj.model : undefined,
    };
  }
  return {};
}
