// Register all built-in tools
import { ToolRegistry } from './registry.js';
import { fileReadTool } from './builtin/file-read.js';
import { fileWriteTool } from './builtin/file-write.js';
import { fileEditTool } from './builtin/file-edit.js';
import { bashTool } from './builtin/bash.js';
import { globTool } from './builtin/glob.js';
import { grepTool } from './builtin/grep.js';
import { askUserTool } from './builtin/ask-user.js';
import { todoTool } from './builtin/todo.js';
import { webSearchTool } from './builtin/web-search.js';
import { webFetchTool } from './builtin/web-fetch.js';
import { subAgentTool, initSubAgentTool } from './builtin/sub-agent.js';
import { planTool } from './builtin/plan.js';
import { dispatchExpertsTool, initDispatchExpertsTool } from './builtin/dispatch-experts.js';
import { listDirTool } from './builtin/list-dir.js';
import { updateMemoryTool } from './builtin/update-memory.js';
import { getTerminalOutputTool } from './builtin/get-terminal-output.js';
import { codebaseSearchTool } from './builtin/codebase-search.js';
import { getProblemsTool } from './builtin/get-problems.js';
import { codeReviewTool, initCodeReviewTool } from './builtin/code-review.js';
import { scheduleTool } from './builtin/schedule.js';
import { slackTool } from './builtin/slack.js';
import { ciTool } from './builtin/ci.js';
// New tools
import { testGeneratorTool } from './builtin/test-generator.js';
import { commentGeneratorTool } from './builtin/comment-generator.js';
import { codeOptimizerTool } from './builtin/code-optimizer.js';
import { codeExplainerTool } from './builtin/code-explainer.js';
// Lint and Git tools
import { lintFixTool } from './builtin/lint-fix.js';
import { gitAutoCommitTool } from './builtin/git-auto-commit.js';
// Multi-agent tool
import { multiAgentTool, initMultiAgentTool } from './builtin/multi-agent.js';
// Cloud tools
import { cloudMemorySearchTool, initCloudMemoryTool } from './builtin/cloud-memory.js';
export { cloudMemorySearchTool, initCloudMemoryTool };
import { cloudSessionTool, initCloudSessionTool } from './builtin/cloud-session.js';
export { cloudSessionTool, initCloudSessionTool };
import { cloudWebhookTool, initCloudWebhookTool } from './builtin/cloud-webhook.js';
export { cloudWebhookTool, initCloudWebhookTool };
// Browser tools
export { initBrowserTools } from './builtin/browser/index.js';
// Planning tools
export { getPlanManager } from '../planning/plan-manager.js';
import { planCreateTool, planUpdateTool, planExecuteTool, planStepCompleteTool, planStepBlockedTool, planRetrospectiveTool, } from './builtin/plan/index.js';
import { browserNavigateTool, browserClickTool, browserTypeTool, browserSelectTool, browserScrollTool, browserScreenshotTool, browserExtractTextTool, browserExtractLinksTool, browserExtractTableTool, browserGoBackTool, browserGoForwardTool, browserPressKeyTool, browserWaitTool, browserCloseTool, browserGetPageInfoTool, } from './builtin/browser/index.js';
export function createDefaultRegistry(disabledTools = [], provider, mode, workspace = '') {
    const registry = new ToolRegistry();
    const allTools = [
        fileReadTool,
        fileWriteTool,
        fileEditTool,
        bashTool,
        globTool,
        grepTool,
        askUserTool,
        todoTool,
        webSearchTool,
        webFetchTool,
        subAgentTool,
        planTool,
        listDirTool,
        updateMemoryTool,
        getTerminalOutputTool,
        codebaseSearchTool,
        getProblemsTool,
        codeReviewTool,
        // Cloud tools
        cloudMemorySearchTool,
        cloudSessionTool,
        cloudWebhookTool,
        scheduleTool,
        slackTool,
        ciTool,
        // Browser tools
        browserNavigateTool,
        browserClickTool,
        browserTypeTool,
        browserSelectTool,
        browserScrollTool,
        browserScreenshotTool,
        browserExtractTextTool,
        browserExtractLinksTool,
        browserExtractTableTool,
        browserGoBackTool,
        browserGoForwardTool,
        browserPressKeyTool,
        browserWaitTool,
        browserCloseTool,
        browserGetPageInfoTool,
        // Planning tools
        planCreateTool,
        planUpdateTool,
        planExecuteTool,
        planStepCompleteTool,
        planStepBlockedTool,
        planRetrospectiveTool,
        // New tools
        testGeneratorTool,
        commentGeneratorTool,
        codeOptimizerTool,
        codeExplainerTool,
        // Lint and Git tools
        lintFixTool,
        gitAutoCommitTool,
        // Multi-agent tool
        multiAgentTool,
    ];
    // In experts mode, add dispatch_experts tool
    if (mode === 'experts') {
        allTools.push(dispatchExpertsTool);
    }
    for (const tool of allTools) {
        if (!disabledTools.includes(tool.name)) {
            registry.register(tool);
        }
    }
    // Initialize sub-agent tool with provider and registry
    if (provider) {
        initSubAgentTool(provider, registry, workspace);
        initMultiAgentTool(provider, registry);
        if (mode === 'experts') {
            initDispatchExpertsTool(provider, registry);
        }
        // Initialize code review tool with sub-agent executor
        initCodeReviewTool(async (agentType, task, signal) => {
            // Create a minimal agent with the code-reviewer preset
            const { Agent } = await import('../agent/agent.js');
            const { getPreset } = await import('../agents/presets.js');
            const preset = getPreset(agentType);
            if (!preset) {
                throw new Error(`Unknown agent type: ${agentType}`);
            }
            const { getPrompt } = await import('../agent/prompts.js');
            const systemPrompt = getPrompt(preset.systemPromptFile);
            // Create a sub-registry with allowed tools
            const subRegistry = new ToolRegistry();
            for (const toolName of preset.allowedTools) {
                const tool = registry.get(toolName);
                if (tool)
                    subRegistry.register(tool);
            }
            const agent = new Agent({
                provider,
                tools: subRegistry,
                systemPrompt: systemPrompt + `\n\nYou are a ${preset.name} sub-agent.`,
                maxTurns: preset.maxTurns,
                workingDirectory: '', // Will be set by caller
            });
            return agent.run(task, signal);
        });
    }
    return registry;
}
//# sourceMappingURL=index.js.map