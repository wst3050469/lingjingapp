// @codepilot/core - Main entry point
// Only exports modules whose dist/*.js files actually exist.
// Static re-exports for missing files are commented out to prevent
// ERR_MODULE_NOT_FOUND crashes during ESM module linkage.
// ── Agent (core files that exist in dist) ──
export { Agent } from './agent/agent.js';
export { Conversation } from './agent/conversation.js';
export { estimateTokens } from './agent/token-counter.js';
// Missing dist files:
// export { loadPrompts, getPrompt, MAIN_PROMPT, CODE_REVIEWER_PROMPT, EXPLORER_PROMPT } from './agent/prompts.js';
// export { AgentScheduler } from './agent/agent-scheduler.js';
// export { AgentCore } from './agent/agent-core.js';
// export { DAGExecutor } from './agent/dag-executor.js';
// export { ContextCompressor } from './agent/context-compressor.js';
// ── LLM (only types.js exists in dist) ──
export * from './llm/types.js';
// Missing dist files:
// export { OpenAIProvider } from './llm/openai.js';
// export { AnthropicProvider } from './llm/anthropic.js';
// export { OllamaProvider } from './llm/ollama.js';
// export { createProvider, OPENAI_COMPATIBLE_PROVIDERS, getModelContextWindow } from './llm/provider-factory.js';
// export { parseSSEStream } from './llm/sse-parser.js';
// ── Tools (only types.js exists in dist) ──
export { toolToSchema } from './tools/types.js';
export * from './tools/types.js';
// Missing dist files:
// export { ToolRegistry } from './tools/registry.js';
// export { ToolPermission } from './tools/tool-permission.js';
// export { BashWhitelist } from './tools/sandbox/bash-whitelist.js';
// export { createDefaultRegistry } from './tools/index.js';
// export { getTodoList } from './tools/builtin/todo.js';
// export { dispatchExpertsTool, initDispatchExpertsTool } from './tools/builtin/dispatch-experts.js';
// export { initUpdateMemoryTool } from './tools/builtin/update-memory.js';
// export { initCodebaseSearchTool } from './tools/builtin/codebase-search.js';
// export { scanAndChunk, chunkFileContent } from './tools/builtin/codebase-search/chunker.js';
// export { initGetProblemsTool } from './tools/builtin/get-problems.js';
// export { initBrowserTools } from './tools/builtin/browser/index.js';
// export { initCodeReviewTool } from './tools/builtin/code-review.js';
// export { cloudMemorySearchTool, initCloudMemoryTool } from './tools/builtin/cloud-memory.js';
// export { cloudSessionTool, initCloudSessionTool } from './tools/builtin/cloud-session.js';
// export { cloudWebhookTool, initCloudWebhookTool } from './tools/builtin/cloud-webhook.js';
// export { generateCommandId, storeBashOutput } from './tools/builtin/bash-output-store.js';
// ── Agents (dist missing) ──
export { AGENT_PRESETS, getPreset, listPresets, EXPERT_PRESETS, getExpertPreset, getExpertPresets } from './agents/index.js';
export { loadAllCustomAgents, getCustomAgent, parseAgentMd } from './agents/index.js';
// ── Config (dist missing) ──
export { AppConfigSchema } from './config/index.js';
export { DEFAULT_CONFIG } from './config/index.js';
export { loadConfig } from './config/index.js';
// ── Git (dist missing) ──
export { gitStatus, gitDiff, gitLog, gitCurrentBranch, isGitRepo, gitRevParseHead, gitDiffNameOnly } from './git/index.js';
export { createPR } from './git/index.js';
// ── Utils (only logger.js exists in dist) ──
export { logger } from './utils/logger.js';
// Missing dist files:
export { truncateString, truncateLines } from './utils/index.js';
export { decodeBuffer, fixGbkString } from './utils/index.js';
export { withRetry } from './utils/index.js';
export * from './utils/index.js';
// ── MCP (complete, all exist) ──
export { McpClient } from './mcp/client.js';
export { McpManager } from './mcp/manager.js';
export * from './mcp/types.js';
// Missing dist files:
export { scanAllSkills, getSkill, getSkillCatalog } from './skills/index.js';
// ── Cloud (complete) ──
export * from './cloud/index.js';
// ── Planning (dist missing) ──
export { getPlanManager } from './planning/index.js';
// ── Memory (reflector.js exists) ──
export { MemoryReflector as Reflector } from './memory/reflector.js';
// ── Completion (dist missing) ──
export { CompletionEngine } from './completion/index.js';
// ── Context (dist missing) ──
export { ContextManager } from './context/index.js';
// ── Intents (dist missing) ──
export { IntentDetector } from './intent/index.js';
// ── Rules (dist missing) ──
export { loadAllRules, getManualRules, applyRules } from './rules/index.js';
// ── Checkpoint (dist missing) ──
export { CheckpointManager } from './checkpoint/index.js';
export { RollbackExecutor } from './checkpoint/index.js';
// ── Indexing/Pipeline (dist missing) ──
export { PipelineEngine, DslParser, TriggerManager } from './pipeline/index.js';
// ── Fusion (complete) ──
export * as fusion from './fusion/index.js';
// ── Security, Errors, Observability, Lifecycle, Cross-Session (all missing) ──
export { DataSanitizer } from './security/index.js';
export * from './security/index.js';
export * from './errors/index.js';
export * from './observability/index.js';
export * from './lifecycle/index.js';
export * from './cross-session/index.js';
// ── Workflow (exists in dist) ──
export * from './workflow/index.js';
//# sourceMappingURL=index.js.map