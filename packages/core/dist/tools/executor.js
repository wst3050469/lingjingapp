// Tool Executor - validates params and executes tools with error handling
// Enhanced with permission checking, data sanitization, audit logging, and metadata
import { ToolRegistry } from './registry.js';
import { StructuredError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
export class ToolExecutor {
    registry;
    permission;
    sanitizer;
    auditLog;
    constructor(deps) {
        if (deps instanceof ToolRegistry) {
            this.registry = deps;
        }
        else {
            this.registry = deps.registry;
            this.permission = deps.permission;
            this.sanitizer = deps.sanitizer;
            this.auditLog = deps.auditLog;
        }
    }
    async execute(toolCall, context) {
        const tool = this.registry.get(toolCall.name);
        if (!tool) {
            return {
                content: `Error: Unknown tool "${toolCall.name}". Available tools: ${this.registry.getAll().map(t => t.name).join(', ')}`,
                isError: true,
            };
        }
        const riskLevel = tool.riskLevel ?? 'safe';
        const startTime = Date.now();
        // Step 1: Sanitize input params
        let params = toolCall.arguments;
        if (this.sanitizer) {
            params = this.sanitizer.sanitize(params);
        }
        // Step 2: Permission check
        if (this.permission) {
            const result = await this.permission.check({
                toolName: toolCall.name,
                riskLevel,
                agentAllowedTools: undefined,
            });
            if (!result.allowed) {
                this.auditLog?.({
                    action: 'tool_call_denied',
                    toolName: toolCall.name,
                    riskLevel,
                    durationMs: Date.now() - startTime,
                });
                return {
                    content: `Permission denied: ${result.reason}`,
                    isError: true,
                };
            }
        }
        // Step 3: Initialize tool if needed
        try {
            await this.registry.initializeTool(toolCall.name);
        }
        catch {
            // Tool may not have lifecycle or already initialized
        }
        // Step 4: Execute tool
        try {
            logger.debug(`Executing tool: ${toolCall.name}`, JSON.stringify(params).slice(0, 200));
            const result = await tool.execute(params, context);
            const durationMs = Date.now() - startTime;
            // Step 5: Attach metadata
            const metadata = {
                durationMs,
                sandboxed: context.enableSandbox,
            };
            // Step 6: Sanitize output
            let finalResult = result;
            if (this.sanitizer && result.content) {
                finalResult = {
                    ...result,
                    content: this.sanitizer.sanitize(result.content),
                };
            }
            // Step 7: Audit log
            this.auditLog?.({
                action: 'tool_call_success',
                toolName: toolCall.name,
                riskLevel,
                durationMs,
            });
            logger.debug(`Tool ${toolCall.name} result:`, finalResult.content.slice(0, 200));
            if (metadata.durationMs || metadata.sandboxed) {
                return { ...finalResult, metadata };
            }
            return finalResult;
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            const structured = StructuredError.from(error);
            this.auditLog?.({
                action: 'tool_call_error',
                toolName: toolCall.name,
                riskLevel,
                durationMs,
                error: structured.message,
            });
            logger.error(`Tool ${toolCall.name} error:`, structured.message);
            return {
                content: `Error executing ${toolCall.name}: ${structured.message}`,
                isError: true,
            };
        }
    }
    async executeAll(toolCalls, context) {
        const results = new Map();
        const settled = await Promise.allSettled(toolCalls.map(async (tc) => {
            const result = await this.execute(tc, context);
            return { id: tc.id, result };
        }));
        for (const outcome of settled) {
            if (outcome.status === 'fulfilled') {
                results.set(outcome.value.id, outcome.value.result);
            }
            else {
                const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
                const idx = settled.indexOf(outcome);
                const tc = toolCalls[idx];
                if (tc) {
                    results.set(tc.id, { content: `Unexpected error: ${reason}`, isError: true });
                }
            }
        }
        return results;
    }
}
//# sourceMappingURL=executor.js.map