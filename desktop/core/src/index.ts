// @codepilot/core - Main entry point
// Only exports modules whose dist/*.js files actually exist.
// Static re-exports for missing files are commented out to prevent
// ERR_MODULE_NOT_FOUND crashes during ESM module linkage.

// ── Agent (core files that exist in dist) ──
export { Agent } from './agent/agent.js';
export { Conversation } from './agent/conversation.js';
export { estimateTokens } from './agent/token-counter.js';
// Missing dist files:
export { loadPrompts, getPrompt, MAIN_PROMPT, clearPromptCache } from './agent/prompts.js';
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
export { createProvider, OPENAI_COMPATIBLE_PROVIDERS, getModelContextWindow } from './llm/provider-factory.js';
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
// export { AGENT_PRESETS, getPreset, listPresets, EXPERT_PRESETS, getExpertPreset, getExpertPresets } from './agents/presets.js';
// export { loadAllCustomAgents, getCustomAgent, parseAgentMd } from './agents/loader.js';

// ── Config (dist missing) ──
// export { AppConfigSchema } from './config/schema.js';
// export { DEFAULT_CONFIG } from './config/defaults.js';
// export { loadConfig } from './config/loader.js';

// ── Git (dist missing) ──
// export { gitStatus, gitDiff, gitLog, gitCurrentBranch, isGitRepo, gitRevParseHead, gitDiffNameOnly } from './git/operations.js';
// export { createPR } from './git/pr.js';

// ── Utils (only logger.js exists in dist) ──
export { logger } from './utils/logger.js';
// Missing dist files:
// export { truncateString, truncateLines } from './utils/truncate.js';
// export { decodeBuffer, fixGbkString } from './utils/encoding.js';
// export { withRetry } from './utils/retry.js';
// export * from './utils/index.js';

// ── MCP (complete, all exist) ──
export { McpClient } from './mcp/client.js';
export { McpManager } from './mcp/manager.js';
export * from './mcp/types.js';
// Missing dist files:
// export { scanAllSkills, getSkill, getSkillCatalog } from './skills/loader.js';

// ── Cloud (complete) ──
export * from './cloud/index.js';

// ── Planning (dist missing) ──
// export { getPlanManager } from './planning/plan-manager.js';

// ── Memory (reflector.js exists) ──
export { MemoryReflector as Reflector } from './memory/reflector.js';

// ── Completion (dist missing) ──
// export { CompletionEngine } from './completion/completion-engine.js';

// ── Context (dist missing) ──
// export { ContextManager } from './context/context-manager.js';

// ── Intents (dist missing) ──
// export { IntentDetector } from './intent/intent-detector.js';

// ── Rules (dist missing) ──
// export { loadAllRules, getManualRules, applyRules } from './rules/index.js';

// ── Checkpoint (dist missing) ──
// export { CheckpointManager } from './checkpoint/manager.js';
// export { RollbackExecutor } from './checkpoint/rollback-executor.js';

// ── Indexing/Pipeline (dist missing) ──
// export { PipelineEngine, DslParser, TriggerManager } from './pipeline/index.js';

// ── Fusion (complete) ──
export * as fusion from './fusion/index.js';

// ── Security, Errors, Observability, Lifecycle, Cross-Session (all missing) ──
// export { DataSanitizer } from './security/data-sanitizer.js';
// export * from './security/index.js';
// export * from './errors/index.js';
// export * from './observability/index.js';
// export * from './lifecycle/index.js';
// export * from './cross-session/index.js';

// ── Workflow (exists in dist) ──
export * from './workflow/index.js';

// ── Type-only exports (safe - erased in compiled JS) ──
export type { AppConfig } from './config/schema.js';
export type { Message } from './fusion/adapters/types.js';
export type { Tool } from './tools/types.js';
export type { AgentEvent } from "./agent/agent.js";
