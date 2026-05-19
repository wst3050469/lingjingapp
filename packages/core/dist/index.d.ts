// Auto-generated type declarations matching dist/index.js exports
// Core config
export { loadConfig, DEFAULT_CONFIG } from './config/loader.js';

// LLM
export { getModelContextWindow, createProvider } from './llm/provider-factory.js';
export * from './llm/types.js';

// Agent
export { Agent } from './agent/agent.js';
export { AgentCore } from './agent/agent-core.js';
export { Conversation } from './agent/conversation.js';

// Tools
export { ToolRegistry } from './tools/registry.js';
export { ToolExecutor } from './tools/executor.js';
export * from './tools/types.js';

// Context
export { ContextManager } from './context/context-manager.js';

// Completion
export { CompletionEngine } from './completion/completion-engine.js';

// Memory
export { MemoryReflector as Reflector } from './memory/reflector.js';

// MCP
export { McpManager } from './mcp/manager.js';
export * from './mcp/types.js';

// Rules
export { loadAllRules, getManualRules, applyRules } from './rules/index.js';

// Checkpoint
export { CheckpointManager } from './checkpoint/manager.js';
export { RollbackExecutor } from './checkpoint/rollback-executor.js';

// Pipeline
export { PipelineEngine, DslParser, TriggerManager } from './pipeline/index.js';

// Utils
export * from './utils/index.js';

// Errors
export * from './errors/index.js';

// Fusion
export * as fusion from './fusion/index.js';

// Intent
export { IntentDetector } from './intent/intent-detector.js';

// Security
export * from './security/index.js';

// Logger
export { logger } from './utils/logger.js';

// Cloud sync
export { CloudSyncClient } from './cloud/sync-client.js';
export { OfflineQueue, MergeStrategy } from './cloud/offline-queue.js';

// ─── Runtime phantom exports ───
// These are imported by electron code and resolved at runtime through asar.
// They may not be in the barrel JS (dist/index.js) but exist in individual dist modules.
// Type declarations are 'any' to satisfy the type checker without adding JS runtime deps.

// Agent extras
export function createDefaultRegistry(): any;
export function loadPrompts(): Promise<any>;
export const MAIN_PROMPT: string;
export function getTodoList(): any;
export function getPrompt(name: string): string;
export function getExpertPresets(): any[];
export type AgentEvent = any;
export type Message = any;

// LLM extras
export type LLMProvider = any;
export type AppConfig = any;
export type ChatRequest = any;

// Tool initializers
export function initDispatchExpertsTool(registry: any): void;
export function initUpdateMemoryTool(registry: any): void;
export function initCodebaseSearchTool(registry: any): void;
export function initGetProblemsTool(registry: any): void;

// Cloud sync extras
export type CloudSyncOptions = any;

// Plan manager
export function getPlanManager(): any;

// Skills
export function scanAllSkills(): Promise<any[]>;
export function getSkill(id: string): any;
export type SkillConfig = any;
export function getSkillCatalog(): any;

// Indexing pipeline
export function scanAndChunk(): any;

// Git operations
export function gitRevParseHead(): string;
export function gitDiffNameOnly(): string[];
export function isGitRepo(): boolean;

// Utils extras
export function truncateString(str: string, maxLen: number): string;
export function generateCommandId(): string;
export function storeBashOutput(id: string, output: string): void;
//# sourceMappingURL=index.d.ts.map
