import type { LLMProvider } from '../llm/types.js';
import { AgentCore } from './agent-core.js';
import { type ToolAuditEvent } from '../tools/executor.js';
import { ToolRegistry } from '../tools/registry.js';
import { ToolPermission, type ToolGlobalPolicy } from '../tools/tool-permission.js';
import { DataSanitizer } from '../security/data-sanitizer.js';
import { ContextCompressor, type ContextBudget } from './context-compressor.js';
import { Tracer } from '../observability/tracer.js';
import { MetricsCollector } from '../observability/metrics-collector.js';
export interface AgentFactoryConfig {
    provider: LLMProvider;
    tools: ToolRegistry;
    systemPrompt: string;
    workingDirectory: string;
    globalPolicy?: ToolGlobalPolicy;
    contextBudget?: Partial<ContextBudget>;
    maxTurns?: number;
    maxDuration?: number;
    turnTimeout?: number;
    maxContextTokens?: number;
    maxResponseTokens?: number;
    temperature?: number;
    askUser?: (question: string) => Promise<string>;
    sshTerminalId?: string;
    enableSandbox?: boolean;
    enableTracing?: boolean;
}
export declare class AgentFactory {
    private tracer;
    private metrics;
    private sanitizer;
    private compressor;
    private permission?;
    private auditLog?;
    constructor(config?: {
        tracer?: Tracer;
        metrics?: MetricsCollector;
        auditLog?: (event: ToolAuditEvent) => void;
        globalPolicy?: ToolGlobalPolicy;
    });
    createCore(config: AgentFactoryConfig): AgentCore;
    getTracer(): Tracer;
    getMetrics(): MetricsCollector;
    getSanitizer(): DataSanitizer;
    getCompressor(): ContextCompressor;
    getPermission(): ToolPermission | undefined;
}
//# sourceMappingURL=agent-factory.d.ts.map