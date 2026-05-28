"use strict";
// @codepilot/core - Main entry point
// Re-exports all public APIs
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpertPresets = exports.getExpertPreset = exports.EXPERT_PRESETS = exports.listPresets = exports.getPreset = exports.AGENT_PRESETS = exports.storeBashOutput = exports.generateCommandId = exports.initCloudWebhookTool = exports.cloudWebhookTool = exports.initCloudSessionTool = exports.cloudSessionTool = exports.initCloudMemoryTool = exports.cloudMemorySearchTool = exports.initCodeReviewTool = exports.initBrowserTools = exports.initGetProblemsTool = exports.chunkFileContent = exports.scanAndChunk = exports.initCodebaseSearchTool = exports.initUpdateMemoryTool = exports.initDispatchExpertsTool = exports.dispatchExpertsTool = exports.getTodoList = exports.createDefaultRegistry = exports.BashWhitelist = exports.ToolPermission = exports.ToolExecutor = exports.ToolRegistry = exports.toolToSchema = exports.parseSSEStream = exports.getModelContextWindow = exports.OPENAI_COMPATIBLE_PROVIDERS = exports.createProvider = exports.OllamaProvider = exports.AnthropicProvider = exports.OpenAIProvider = exports.ContextCompressor = exports.DAGExecutor = exports.AgentFactory = exports.AgentCore = exports.AgentScheduler = exports.EXPLORER_PROMPT = exports.CODE_REVIEWER_PROMPT = exports.MAIN_PROMPT = exports.getPrompt = exports.loadPrompts = exports.estimateTokens = exports.Conversation = exports.Agent = void 0;
exports.DataSanitizer = exports.fusion = exports.TriggerManager = exports.DslParser = exports.PipelineEngine = exports.RollbackExecutor = exports.CheckpointManager = exports.applyRules = exports.getManualRules = exports.loadAllRules = exports.IntentDetector = exports.ContextManager = exports.CompletionEngine = exports.Reflector = exports.getPlanManager = exports.getSkillCatalog = exports.getSkill = exports.scanAllSkills = exports.McpManager = exports.McpClient = exports.withRetry = exports.fixGbkString = exports.decodeBuffer = exports.truncateLines = exports.truncateString = exports.logger = exports.createPR = exports.gitDiffNameOnly = exports.gitRevParseHead = exports.isGitRepo = exports.gitCurrentBranch = exports.gitLog = exports.gitDiff = exports.gitStatus = exports.loadConfig = exports.DEFAULT_CONFIG = exports.AppConfigSchema = exports.parseAgentMd = exports.getCustomAgent = exports.loadAllCustomAgents = void 0;
// Agent
var agent_js_1 = require("./agent/agent.js");
Object.defineProperty(exports, "Agent", { enumerable: true, get: function () { return agent_js_1.Agent; } });
var conversation_js_1 = require("./agent/conversation.js");
Object.defineProperty(exports, "Conversation", { enumerable: true, get: function () { return conversation_js_1.Conversation; } });
var token_counter_js_1 = require("./agent/token-counter.js");
Object.defineProperty(exports, "estimateTokens", { enumerable: true, get: function () { return token_counter_js_1.estimateTokens; } });
var prompts_js_1 = require("./agent/prompts.js");
Object.defineProperty(exports, "loadPrompts", { enumerable: true, get: function () { return prompts_js_1.loadPrompts; } });
Object.defineProperty(exports, "getPrompt", { enumerable: true, get: function () { return prompts_js_1.getPrompt; } });
Object.defineProperty(exports, "MAIN_PROMPT", { enumerable: true, get: function () { return prompts_js_1.MAIN_PROMPT; } });
Object.defineProperty(exports, "CODE_REVIEWER_PROMPT", { enumerable: true, get: function () { return prompts_js_1.CODE_REVIEWER_PROMPT; } });
Object.defineProperty(exports, "EXPLORER_PROMPT", { enumerable: true, get: function () { return prompts_js_1.EXPLORER_PROMPT; } });
var agent_scheduler_js_1 = require("./agent/agent-scheduler.js");
Object.defineProperty(exports, "AgentScheduler", { enumerable: true, get: function () { return agent_scheduler_js_1.AgentScheduler; } });
var agent_core_js_1 = require("./agent/agent-core.js");
Object.defineProperty(exports, "AgentCore", { enumerable: true, get: function () { return agent_core_js_1.AgentCore; } });
var agent_factory_js_1 = require("./agent/agent-factory.js");
Object.defineProperty(exports, "AgentFactory", { enumerable: true, get: function () { return agent_factory_js_1.AgentFactory; } });
var dag_executor_js_1 = require("./agent/dag-executor.js");
Object.defineProperty(exports, "DAGExecutor", { enumerable: true, get: function () { return dag_executor_js_1.DAGExecutor; } });
var context_compressor_js_1 = require("./agent/context-compressor.js");
Object.defineProperty(exports, "ContextCompressor", { enumerable: true, get: function () { return context_compressor_js_1.ContextCompressor; } });
// LLM
var openai_js_1 = require("./llm/openai.js");
Object.defineProperty(exports, "OpenAIProvider", { enumerable: true, get: function () { return openai_js_1.OpenAIProvider; } });
var anthropic_js_1 = require("./llm/anthropic.js");
Object.defineProperty(exports, "AnthropicProvider", { enumerable: true, get: function () { return anthropic_js_1.AnthropicProvider; } });
var ollama_js_1 = require("./llm/ollama.js");
Object.defineProperty(exports, "OllamaProvider", { enumerable: true, get: function () { return ollama_js_1.OllamaProvider; } });
var provider_factory_js_1 = require("./llm/provider-factory.js");
Object.defineProperty(exports, "createProvider", { enumerable: true, get: function () { return provider_factory_js_1.createProvider; } });
Object.defineProperty(exports, "OPENAI_COMPATIBLE_PROVIDERS", { enumerable: true, get: function () { return provider_factory_js_1.OPENAI_COMPATIBLE_PROVIDERS; } });
Object.defineProperty(exports, "getModelContextWindow", { enumerable: true, get: function () { return provider_factory_js_1.getModelContextWindow; } });
var sse_parser_js_1 = require("./llm/sse-parser.js");
Object.defineProperty(exports, "parseSSEStream", { enumerable: true, get: function () { return sse_parser_js_1.parseSSEStream; } });
__exportStar(require("./llm/types.js"), exports);
// Tools
var types_js_1 = require("./tools/types.js");
Object.defineProperty(exports, "toolToSchema", { enumerable: true, get: function () { return types_js_1.toolToSchema; } });
__exportStar(require("./tools/types.js"), exports);
var registry_js_1 = require("./tools/registry.js");
Object.defineProperty(exports, "ToolRegistry", { enumerable: true, get: function () { return registry_js_1.ToolRegistry; } });
var executor_js_1 = require("./tools/executor.js");
Object.defineProperty(exports, "ToolExecutor", { enumerable: true, get: function () { return executor_js_1.ToolExecutor; } });
var tool_permission_js_1 = require("./tools/tool-permission.js");
Object.defineProperty(exports, "ToolPermission", { enumerable: true, get: function () { return tool_permission_js_1.ToolPermission; } });
var bash_whitelist_js_1 = require("./tools/sandbox/bash-whitelist.js");
Object.defineProperty(exports, "BashWhitelist", { enumerable: true, get: function () { return bash_whitelist_js_1.BashWhitelist; } });
var index_js_1 = require("./tools/index.js");
Object.defineProperty(exports, "createDefaultRegistry", { enumerable: true, get: function () { return index_js_1.createDefaultRegistry; } });
var todo_js_1 = require("./tools/builtin/todo.js");
Object.defineProperty(exports, "getTodoList", { enumerable: true, get: function () { return todo_js_1.getTodoList; } });
var dispatch_experts_js_1 = require("./tools/builtin/dispatch-experts.js");
Object.defineProperty(exports, "dispatchExpertsTool", { enumerable: true, get: function () { return dispatch_experts_js_1.dispatchExpertsTool; } });
Object.defineProperty(exports, "initDispatchExpertsTool", { enumerable: true, get: function () { return dispatch_experts_js_1.initDispatchExpertsTool; } });
var update_memory_js_1 = require("./tools/builtin/update-memory.js");
Object.defineProperty(exports, "initUpdateMemoryTool", { enumerable: true, get: function () { return update_memory_js_1.initUpdateMemoryTool; } });
var codebase_search_js_1 = require("./tools/builtin/codebase-search.js");
Object.defineProperty(exports, "initCodebaseSearchTool", { enumerable: true, get: function () { return codebase_search_js_1.initCodebaseSearchTool; } });
var chunker_js_1 = require("./tools/builtin/codebase-search/chunker.js");
Object.defineProperty(exports, "scanAndChunk", { enumerable: true, get: function () { return chunker_js_1.scanAndChunk; } });
Object.defineProperty(exports, "chunkFileContent", { enumerable: true, get: function () { return chunker_js_1.chunkFileContent; } });
var get_problems_js_1 = require("./tools/builtin/get-problems.js");
Object.defineProperty(exports, "initGetProblemsTool", { enumerable: true, get: function () { return get_problems_js_1.initGetProblemsTool; } });
var index_js_2 = require("./tools/builtin/browser/index.js");
Object.defineProperty(exports, "initBrowserTools", { enumerable: true, get: function () { return index_js_2.initBrowserTools; } });
var code_review_js_1 = require("./tools/builtin/code-review.js");
Object.defineProperty(exports, "initCodeReviewTool", { enumerable: true, get: function () { return code_review_js_1.initCodeReviewTool; } });
var cloud_memory_js_1 = require("./tools/builtin/cloud-memory.js");
Object.defineProperty(exports, "cloudMemorySearchTool", { enumerable: true, get: function () { return cloud_memory_js_1.cloudMemorySearchTool; } });
Object.defineProperty(exports, "initCloudMemoryTool", { enumerable: true, get: function () { return cloud_memory_js_1.initCloudMemoryTool; } });
var cloud_session_js_1 = require("./tools/builtin/cloud-session.js");
Object.defineProperty(exports, "cloudSessionTool", { enumerable: true, get: function () { return cloud_session_js_1.cloudSessionTool; } });
Object.defineProperty(exports, "initCloudSessionTool", { enumerable: true, get: function () { return cloud_session_js_1.initCloudSessionTool; } });
var cloud_webhook_js_1 = require("./tools/builtin/cloud-webhook.js");
Object.defineProperty(exports, "cloudWebhookTool", { enumerable: true, get: function () { return cloud_webhook_js_1.cloudWebhookTool; } });
Object.defineProperty(exports, "initCloudWebhookTool", { enumerable: true, get: function () { return cloud_webhook_js_1.initCloudWebhookTool; } });
var bash_output_store_js_1 = require("./tools/builtin/bash-output-store.js");
Object.defineProperty(exports, "generateCommandId", { enumerable: true, get: function () { return bash_output_store_js_1.generateCommandId; } });
Object.defineProperty(exports, "storeBashOutput", { enumerable: true, get: function () { return bash_output_store_js_1.storeBashOutput; } });
// Agents
var presets_js_1 = require("./agents/presets.js");
Object.defineProperty(exports, "AGENT_PRESETS", { enumerable: true, get: function () { return presets_js_1.AGENT_PRESETS; } });
Object.defineProperty(exports, "getPreset", { enumerable: true, get: function () { return presets_js_1.getPreset; } });
Object.defineProperty(exports, "listPresets", { enumerable: true, get: function () { return presets_js_1.listPresets; } });
Object.defineProperty(exports, "EXPERT_PRESETS", { enumerable: true, get: function () { return presets_js_1.EXPERT_PRESETS; } });
Object.defineProperty(exports, "getExpertPreset", { enumerable: true, get: function () { return presets_js_1.getExpertPreset; } });
Object.defineProperty(exports, "getExpertPresets", { enumerable: true, get: function () { return presets_js_1.getExpertPresets; } });
var loader_js_1 = require("./agents/loader.js");
Object.defineProperty(exports, "loadAllCustomAgents", { enumerable: true, get: function () { return loader_js_1.loadAllCustomAgents; } });
Object.defineProperty(exports, "getCustomAgent", { enumerable: true, get: function () { return loader_js_1.getCustomAgent; } });
Object.defineProperty(exports, "parseAgentMd", { enumerable: true, get: function () { return loader_js_1.parseAgentMd; } });
// Config
var schema_js_1 = require("./config/schema.js");
Object.defineProperty(exports, "AppConfigSchema", { enumerable: true, get: function () { return schema_js_1.AppConfigSchema; } });
var defaults_js_1 = require("./config/defaults.js");
Object.defineProperty(exports, "DEFAULT_CONFIG", { enumerable: true, get: function () { return defaults_js_1.DEFAULT_CONFIG; } });
var loader_js_2 = require("./config/loader.js");
Object.defineProperty(exports, "loadConfig", { enumerable: true, get: function () { return loader_js_2.loadConfig; } });
// Git
var operations_js_1 = require("./git/operations.js");
Object.defineProperty(exports, "gitStatus", { enumerable: true, get: function () { return operations_js_1.gitStatus; } });
Object.defineProperty(exports, "gitDiff", { enumerable: true, get: function () { return operations_js_1.gitDiff; } });
Object.defineProperty(exports, "gitLog", { enumerable: true, get: function () { return operations_js_1.gitLog; } });
Object.defineProperty(exports, "gitCurrentBranch", { enumerable: true, get: function () { return operations_js_1.gitCurrentBranch; } });
Object.defineProperty(exports, "isGitRepo", { enumerable: true, get: function () { return operations_js_1.isGitRepo; } });
Object.defineProperty(exports, "gitRevParseHead", { enumerable: true, get: function () { return operations_js_1.gitRevParseHead; } });
Object.defineProperty(exports, "gitDiffNameOnly", { enumerable: true, get: function () { return operations_js_1.gitDiffNameOnly; } });
var pr_js_1 = require("./git/pr.js");
Object.defineProperty(exports, "createPR", { enumerable: true, get: function () { return pr_js_1.createPR; } });
// Utils
var logger_js_1 = require("./utils/logger.js");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_js_1.logger; } });
var truncate_js_1 = require("./utils/truncate.js");
Object.defineProperty(exports, "truncateString", { enumerable: true, get: function () { return truncate_js_1.truncateString; } });
Object.defineProperty(exports, "truncateLines", { enumerable: true, get: function () { return truncate_js_1.truncateLines; } });
var encoding_js_1 = require("./utils/encoding.js");
Object.defineProperty(exports, "decodeBuffer", { enumerable: true, get: function () { return encoding_js_1.decodeBuffer; } });
Object.defineProperty(exports, "fixGbkString", { enumerable: true, get: function () { return encoding_js_1.fixGbkString; } });
var retry_js_1 = require("./utils/retry.js");
Object.defineProperty(exports, "withRetry", { enumerable: true, get: function () { return retry_js_1.withRetry; } });
__exportStar(require("./utils/index.js"), exports);
// MCP
var client_js_1 = require("./mcp/client.js");
Object.defineProperty(exports, "McpClient", { enumerable: true, get: function () { return client_js_1.McpClient; } });
var manager_js_1 = require("./mcp/manager.js");
Object.defineProperty(exports, "McpManager", { enumerable: true, get: function () { return manager_js_1.McpManager; } });
__exportStar(require("./mcp/types.js"), exports);
var loader_js_3 = require("./skills/loader.js");
Object.defineProperty(exports, "scanAllSkills", { enumerable: true, get: function () { return loader_js_3.scanAllSkills; } });
Object.defineProperty(exports, "getSkill", { enumerable: true, get: function () { return loader_js_3.getSkill; } });
Object.defineProperty(exports, "getSkillCatalog", { enumerable: true, get: function () { return loader_js_3.getSkillCatalog; } });
// Cloud
__exportStar(require("./cloud/index.js"), exports);
// Planning
var plan_manager_js_1 = require("./planning/plan-manager.js");
Object.defineProperty(exports, "getPlanManager", { enumerable: true, get: function () { return plan_manager_js_1.getPlanManager; } });
// Memory
var reflector_js_1 = require("./memory/reflector.js");
Object.defineProperty(exports, "Reflector", { enumerable: true, get: function () { return reflector_js_1.MemoryReflector; } });
// Completion
var completion_engine_js_1 = require("./completion/completion-engine.js");
Object.defineProperty(exports, "CompletionEngine", { enumerable: true, get: function () { return completion_engine_js_1.CompletionEngine; } });
// Context
var context_manager_js_1 = require("./context/context-manager.js");
Object.defineProperty(exports, "ContextManager", { enumerable: true, get: function () { return context_manager_js_1.ContextManager; } });
// Intents
var intent_detector_js_1 = require("./intent/intent-detector.js");
Object.defineProperty(exports, "IntentDetector", { enumerable: true, get: function () { return intent_detector_js_1.IntentDetector; } });
// Rules
var index_js_3 = require("./rules/index.js");
Object.defineProperty(exports, "loadAllRules", { enumerable: true, get: function () { return index_js_3.loadAllRules; } });
Object.defineProperty(exports, "getManualRules", { enumerable: true, get: function () { return index_js_3.getManualRules; } });
Object.defineProperty(exports, "applyRules", { enumerable: true, get: function () { return index_js_3.applyRules; } });
// Checkpoint
var manager_js_2 = require("./checkpoint/manager.js");
Object.defineProperty(exports, "CheckpointManager", { enumerable: true, get: function () { return manager_js_2.CheckpointManager; } });
var rollback_executor_js_1 = require("./checkpoint/rollback-executor.js");
Object.defineProperty(exports, "RollbackExecutor", { enumerable: true, get: function () { return rollback_executor_js_1.RollbackExecutor; } });
// Indexing
var index_js_4 = require("./pipeline/index.js");
Object.defineProperty(exports, "PipelineEngine", { enumerable: true, get: function () { return index_js_4.PipelineEngine; } });
Object.defineProperty(exports, "DslParser", { enumerable: true, get: function () { return index_js_4.DslParser; } });
Object.defineProperty(exports, "TriggerManager", { enumerable: true, get: function () { return index_js_4.TriggerManager; } });
// Fusion
exports.fusion = __importStar(require("./fusion/index.js"));
// Security
var data_sanitizer_js_1 = require("./security/data-sanitizer.js");
Object.defineProperty(exports, "DataSanitizer", { enumerable: true, get: function () { return data_sanitizer_js_1.DataSanitizer; } });
__exportStar(require("./security/index.js"), exports);
// Errors
__exportStar(require("./errors/index.js"), exports);
// Observability
__exportStar(require("./observability/index.js"), exports);
// Lifecycle
__exportStar(require("./lifecycle/index.js"), exports);
// Cross-Session Memory
__exportStar(require("./cross-session/index.js"), exports);
//# sourceMappingURL=index.js.map