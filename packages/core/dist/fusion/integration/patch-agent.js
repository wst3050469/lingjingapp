"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchAgentHooks = patchAgentHooks;
const types_js_1 = require("../hook-registry/types.js");
const logger_js_1 = require("../../utils/logger.js");
function patchAgentHooks(hookRegistry, eventBus) {
    return {
        async beforeRun(agent, prompt) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(types_js_1.HookPoint.BEFORE_LLM_CALL, {
                        ...agentCtx,
                        prompt,
                    });
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[Fusion:Agent] BEFORE_LLM_CALL hook error: ${err.message}`);
            }
            if (eventBus) {
                eventBus.publish('agent:message_start', {
                    ...agentCtx,
                    prompt,
                    timestamp: Date.now(),
                }, 'agent-hooks');
            }
        },
        async afterLLMResponse(agent, response) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(types_js_1.HookPoint.AFTER_LLM_CALL, {
                        ...agentCtx,
                        ...response,
                    });
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[Fusion:Agent] AFTER_LLM_CALL hook error: ${err.message}`);
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
        async beforeToolExecute(agent, ctx) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    const result = await hookRegistry.execute(types_js_1.HookPoint.BEFORE_TOOL_EXECUTE, {
                        ...agentCtx,
                        ...ctx,
                    });
                    return { ...ctx, ...result.data };
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[Fusion:Agent] BEFORE_TOOL_EXECUTE hook error: ${err.message}`);
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
        async afterToolExecute(agent, ctx) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(types_js_1.HookPoint.AFTER_TOOL_EXECUTE, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[Fusion:Agent] AFTER_TOOL_EXECUTE hook error: ${err.message}`);
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
        async beforeSkillLoad(agent, ctx) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(types_js_1.HookPoint.BEFORE_SKILL_LOAD, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[Fusion:Agent] BEFORE_SKILL_LOAD hook error: ${err.message}`);
            }
        },
        async afterSkillLoad(agent, ctx) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(types_js_1.HookPoint.AFTER_SKILL_LOAD, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[Fusion:Agent] AFTER_SKILL_LOAD hook error: ${err.message}`);
            }
            if (eventBus) {
                eventBus.publish('skill:loaded', {
                    ...agentCtx,
                    skillName: ctx.skillName,
                }, 'agent-hooks');
            }
        },
        async beforeMemoryWrite(agent, ctx) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(types_js_1.HookPoint.BEFORE_MEMORY_WRITE, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[Fusion:Agent] BEFORE_MEMORY_WRITE hook error: ${err.message}`);
            }
        },
        async afterCompaction(agent, ctx) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(types_js_1.HookPoint.AFTER_COMPACTION, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger_js_1.logger.warn(`[Fusion:Agent] AFTER_COMPACTION hook error: ${err.message}`);
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
function extractAgentContext(agent) {
    if (agent && typeof agent === 'object') {
        const obj = agent;
        return {
            sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : undefined,
            conversationId: typeof obj.conversationId === 'string' ? obj.conversationId : undefined,
            model: typeof obj.model === 'string' ? obj.model : undefined,
        };
    }
    return {};
}
//# sourceMappingURL=patch-agent.js.map