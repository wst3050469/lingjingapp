import { HookPoint } from '../hook-registry/types.js';
import { logger } from '../../utils/logger.js';
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
export function patchAgentHooks(hookRegistry, eventBus) {
    return {
        async beforeRun(agent, prompt) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(HookPoint.BEFORE_LLM_CALL, {
                        ...agentCtx,
                        prompt,
                    });
                }
            }
            catch (err) {
                logger.warn(`[Fusion:Agent] BEFORE_LLM_CALL hook error: ${err.message}`);
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
                    await hookRegistry.execute(HookPoint.AFTER_LLM_CALL, {
                        ...agentCtx,
                        ...response,
                    });
                }
            }
            catch (err) {
                logger.warn(`[Fusion:Agent] AFTER_LLM_CALL hook error: ${err.message}`);
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
                    const result = await hookRegistry.execute(HookPoint.BEFORE_TOOL_EXECUTE, {
                        ...agentCtx,
                        ...ctx,
                    });
                    return { ...ctx, ...result.data };
                }
            }
            catch (err) {
                logger.warn(`[Fusion:Agent] BEFORE_TOOL_EXECUTE hook error: ${err.message}`);
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
                    await hookRegistry.execute(HookPoint.AFTER_TOOL_EXECUTE, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger.warn(`[Fusion:Agent] AFTER_TOOL_EXECUTE hook error: ${err.message}`);
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
                    await hookRegistry.execute(HookPoint.BEFORE_SKILL_LOAD, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger.warn(`[Fusion:Agent] BEFORE_SKILL_LOAD hook error: ${err.message}`);
            }
        },
        async afterSkillLoad(agent, ctx) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(HookPoint.AFTER_SKILL_LOAD, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger.warn(`[Fusion:Agent] AFTER_SKILL_LOAD hook error: ${err.message}`);
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
                    await hookRegistry.execute(HookPoint.BEFORE_MEMORY_WRITE, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger.warn(`[Fusion:Agent] BEFORE_MEMORY_WRITE hook error: ${err.message}`);
            }
        },
        async afterCompaction(agent, ctx) {
            const agentCtx = extractAgentContext(agent);
            try {
                if (hookRegistry) {
                    await hookRegistry.execute(HookPoint.AFTER_COMPACTION, {
                        ...agentCtx,
                        ...ctx,
                    });
                }
            }
            catch (err) {
                logger.warn(`[Fusion:Agent] AFTER_COMPACTION hook error: ${err.message}`);
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
