import type { ToolCall, ToolResult } from '../agent/message-types.js';
import type { ToolContext, RiskLevel } from './types.js';
import { ToolRegistry } from './registry.js';
import { ToolPermission } from './tool-permission.js';
import { DataSanitizer } from '../security/data-sanitizer.js';
export interface ToolExecutorDeps {
    registry: ToolRegistry;
    permission?: ToolPermission;
    sanitizer?: DataSanitizer;
    auditLog?: (event: ToolAuditEvent) => void;
}
export interface ToolAuditEvent {
    action: 'tool_call' | 'tool_call_denied' | 'tool_call_error' | 'tool_call_success';
    toolName: string;
    riskLevel?: RiskLevel;
    durationMs?: number;
    error?: string;
    traceId?: string;
}
export declare class ToolExecutor {
    private registry;
    private permission?;
    private sanitizer?;
    private auditLog?;
    constructor(deps: ToolExecutorDeps | ToolRegistry);
    execute(toolCall: ToolCall, context: ToolContext): Promise<ToolResult>;
    executeAll(toolCalls: ToolCall[], context: ToolContext): Promise<Map<string, ToolResult>>;
}
//# sourceMappingURL=executor.d.ts.map