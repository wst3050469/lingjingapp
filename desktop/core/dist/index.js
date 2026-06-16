// @codepilot/core - Main entry point (v1.73.91: all exports enabled with stubs)
// All modules now have stub implementations — no more commented-out exports.
// This allows esbuild to bundle (if needed) and Node.js to resolve all imports.

// ── Agent ──
export { Agent } from './agent/agent.js';
export { Conversation } from './agent/conversation.js';
export { estimateTokens } from './agent/token-counter.js';
export { loadPrompts, getPrompt, MAIN_PROMPT, clearPromptCache } from './agent/prompts.js';

// ── LLM ──
export * from './llm/types.js';
export { createProvider, OPENAI_COMPATIBLE_PROVIDERS, getModelContextWindow } from './llm/provider-factory.js';

// ── Tools ──
export { toolToSchema } from './tools/types.js';
export * from './tools/types.js';
export { ToolRegistry } from './tools/registry.js';
export { createDefaultRegistry } from './tools/index.js';
export {
  getTodoList,
  dispatchExpertsTool, initDispatchExpertsTool,
  initUpdateMemoryTool,
  initCodebaseSearchTool,
  scanAndChunk, chunkFileContent,
  initGetProblemsTool,
  initBrowserTools,
  initCodeReviewTool,
  cloudMemorySearchTool, initCloudMemoryTool,
  cloudSessionTool, initCloudSessionTool,
  cloudWebhookTool, initCloudWebhookTool,
  generateCommandId, storeBashOutput,
} from './tools/builtin/index.js';

// ── Agents ──
export {
  AGENT_PRESETS, getPreset, listPresets,
  EXPERT_PRESETS, getExpertPreset, getExpertPresets,
  loadAllCustomAgents, getCustomAgent, parseAgentMd,
} from './agents/index.js';

// ── Config ──
export { loadConfig, AppConfigSchema, DEFAULT_CONFIG } from './config/index.js';

// ── Git ──
export {
  gitStatus, gitDiff, gitLog, gitCurrentBranch,
  isGitRepo, gitRevParseHead, gitDiffNameOnly, createPR,
} from './git/index.js';

// ── Utils ──
export { logger } from './utils/logger.js';
export {
  VersionParser, SemanticVersion,
  truncateString, truncateLines,
  decodeBuffer, fixGbkString, withRetry,
} from './utils/index.js';

// ── MCP ──
export { McpClient } from './mcp/client.js';
export { McpManager } from './mcp/manager.js';
export * from './mcp/types.js';

// ── Skills ──
export { scanAllSkills, getSkill, getSkillCatalog } from './skills/index.js';

// ── Cloud ──
export * from './cloud/index.js';

// ── Planning ──
export { getPlanManager } from './planning/index.js';

// ── Memory ──
export { MemoryReflector as Reflector } from './memory/reflector.js';

// ── Completion ──
export { CompletionEngine } from './completion/index.js';

// ── Context ──
export { ContextManager } from './context/index.js';

// ── Intents ──
export { IntentDetector } from './intent/index.js';

// ── Rules ──
export { loadAllRules, applyRules, getManualRules, RuleMerger } from './rules/index.js';

// ── Checkpoint ──
export {
  CheckpointManager, FileCheckpointStorage,
  SnapshotCreator, RollbackExecutor, CheckpointCleaner,
} from './checkpoint/index.js';

// ── Pipeline ──
export { PipelineEngine, DslParser, TriggerManager } from './pipeline/index.js';

// ── Fusion ──
export * as fusion from './fusion/index.js';

// ── Security ──
export { SecurityScanner, SecurityFixIntegration, DataSanitizer } from './security/index.js';

// ── Errors, Observability, Lifecycle, Cross-Session ──
export * from './errors/index.js';
export * from './observability/index.js';
export * from './lifecycle/index.js';
export * from './cross-session/index.js';

// ── Workflow ──
export * from './workflow/index.js';

// ── Connector / Batch (referenced by electron code) ──
export class ConnectorManager {
  constructor() {}
  async list() { return []; }
  async connect() { return { success: false, error: 'Not implemented' }; }
}
export class BaseConnector {}
export class TokenManager {
  async getToken() { return null; }
}
export class GitHubClient {
  async listRepos() { return []; }
}

// ── Batch processing stubs ──
export class BatchTaskQueue {
  async enqueue() { return ''; }
  async dequeue() { return null; }
}
export class BatchExecutor {
  async execute() { return { success: false }; }
}
export class BatchResult {}

//# sourceMappingURL=index.js.map
