import { AgentCore } from './agent-core.js';
// Use lazy import to survive missing executor.js (anti-virus, extraction issues)
let _ToolExecutorClass = null;
async function _loadToolExecutor() {
  if (_ToolExecutorClass) return _ToolExecutorClass;
  try {
    const mod = await import('../tools/executor.js');
    _ToolExecutorClass = mod.ToolExecutor;
  } catch (err) {
    // Fallback: minimal executor that delegates directly
    _ToolExecutorClass = class FallbackExecutor {
      constructor(opts) { this.registry = opts?.registry; }
      async execute(toolCall, context) {
        const tool = this.registry?.get?.(toolCall.name);
        if (!tool) return { content: `Unknown tool: ${toolCall.name}`, isError: true };
        try { return await tool.execute(toolCall.arguments, context); }
        catch (e) { return { content: String(e.message), isError: true }; }
      }
    };
  }
  return _ToolExecutorClass;
}
import { ToolPermission } from '../tools/tool-permission.js';
import { DataSanitizer } from '../security/data-sanitizer.js';
import { ContextCompressor } from './context-compressor.js';
import { Tracer } from '../observability/tracer.js';
import { MetricsCollector } from '../observability/metrics-collector.js';
export class AgentFactory {
    tracer;
    metrics;
    sanitizer;
    compressor;
    permission;
    auditLog;
    constructor(config) {
        this.tracer = config?.tracer ?? new Tracer();
        this.metrics = config?.metrics ?? new MetricsCollector();
        this.sanitizer = new DataSanitizer();
        this.compressor = new ContextCompressor();
        if (config?.globalPolicy) {
            this.permission = new ToolPermission(config.globalPolicy);
        }
        this.auditLog = config?.auditLog;
    }
    async createCore(config) {
        const ToolExecutorClass = await _loadToolExecutor();
        const executor = new ToolExecutorClass({
            registry: config.tools,
            permission: this.permission,
            sanitizer: this.sanitizer,
            auditLog: this.auditLog,
        });
        const coreConfig = {
            provider: config.provider,
            tools: config.tools,
            executor,
            systemPrompt: config.systemPrompt,
            maxTurns: config.maxTurns ?? 500,
            maxDuration: config.maxDuration ?? 0,
            turnTimeout: config.turnTimeout ?? 600000,
            maxContextTokens: config.maxContextTokens ?? 200000,
            maxResponseTokens: config.maxResponseTokens ?? 8192,
            temperature: config.temperature ?? 0.7,
            workingDirectory: config.workingDirectory,
            askUser: config.askUser,
            sshTerminalId: config.sshTerminalId,
            enableSandbox: config.enableSandbox,
        };
        return new AgentCore(coreConfig);
    }
    getTracer() {
        return this.tracer;
    }
    getMetrics() {
        return this.metrics;
    }
    getSanitizer() {
        return this.sanitizer;
    }
    getCompressor() {
        return this.compressor;
    }
    getPermission() {
        return this.permission;
    }
}
//# sourceMappingURL=agent-factory.js.map