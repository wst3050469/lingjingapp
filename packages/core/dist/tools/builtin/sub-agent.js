// Sub-agent tool - spawns child agents for specialized tasks
import { Agent } from '../../agent/agent.js';
import { getPreset, listPresets } from '../../agents/presets.js';
import { getPrompt } from '../../agent/prompts.js';
import { loadAllCustomAgents } from '../../agents/loader.js';
// These are injected when the tool is created
let _provider = null;
let _parentRegistry = null;
let _workspace = '';
export function initSubAgentTool(provider, registry, workspace = '') {
    _provider = provider;
    _parentRegistry = registry;
    _workspace = workspace;
}
/**
 * Build dynamic agent_type description including both built-in presets and custom agents.
 */
async function getAgentTypesDescription() {
    const builtInPresets = listPresets();
    const builtInTypes = builtInPresets.map(p => `"${p.name}" (${p.description})`).join('; ');
    let customAgentsList = '';
    try {
        const customAgents = await loadAllCustomAgents(_workspace);
        if (customAgents.size > 0) {
            customAgentsList = '; Custom agents: ' + Array.from(customAgents.values())
                .map(a => `"${a.name}" (${a.description})`)
                .join('; ');
        }
    }
    catch {
        // Ignore errors loading custom agents
    }
    return `Available agent types: ${builtInTypes}${customAgentsList}`;
}
export const subAgentTool = {
    name: 'sub_agent',
    description: 'Spawn a specialized sub-agent (built-in or custom) to handle a specific task.',
    parameters: {
        type: 'object',
        properties: {
            agent_type: {
                type: 'string',
                description: 'The type of agent to spawn (built-in preset or custom agent name)',
            },
            task: {
                type: 'string',
                description: 'The task description for the sub-agent to complete',
            },
        },
        required: ['agent_type', 'task'],
    },
    async execute(params, context) {
        const agentType = params.agent_type;
        const task = params.task;
        if (!_provider || !_parentRegistry) {
            return { content: 'Sub-agent system not initialized', isError: true };
        }
        // First try built-in presets
        const preset = getPreset(agentType);
        if (preset) {
            // Create a tool registry subset for the sub-agent
            const subTools = _parentRegistry.getSubset(preset.allowedTools);
            // Load system prompt from embedded prompts
            const systemPrompt = getPrompt(preset.systemPromptFile);
            // Create and run sub-agent
            const subAgent = new Agent({
                provider: _provider,
                tools: subTools,
                systemPrompt: systemPrompt + `\n\nYou are a ${preset.name} sub-agent. Complete the following task and return your findings/results.`,
                maxTurns: preset.maxTurns,
                workingDirectory: context.workingDirectory,
                // No onEvent - sub-agent runs silently
            });
            try {
                const result = await subAgent.run(task, context.signal);
                return { content: `[${preset.name} agent result]:\n${result}` };
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                return { content: `Sub-agent (${preset.name}) failed: ${msg}`, isError: true };
            }
        }
        // If not a built-in preset, try custom agents
        try {
            const customAgents = await loadAllCustomAgents(_workspace);
            const customAgentConfig = customAgents.get(agentType);
            if (customAgentConfig) {
                // Create a restricted tool registry for the custom agent
                const subTools = _parentRegistry.getSubset(customAgentConfig.tools);
                // Create and run custom sub-agent
                const subAgent = new Agent({
                    provider: _provider,
                    tools: subTools,
                    systemPrompt: customAgentConfig.systemPrompt + `\n\nYou are the "${customAgentConfig.name}" custom agent. Complete the following task and return your findings/results.`,
                    maxTurns: customAgentConfig.maxTurns,
                    workingDirectory: context.workingDirectory,
                    temperature: customAgentConfig.temperature,
                    // No onEvent - sub-agent runs silently
                });
                try {
                    const result = await subAgent.run(task, context.signal);
                    return { content: `[${customAgentConfig.name} custom agent result]:\n${result}` };
                }
                catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    return { content: `Custom sub-agent (${customAgentConfig.name}) failed: ${msg}`, isError: true };
                }
            }
            // Agent not found
            const allAgentNames = [
                ...listPresets().map(p => p.name),
                ...Array.from((await loadAllCustomAgents(_workspace)).keys()),
            ];
            return {
                content: `Unknown agent type: "${agentType}". Available: ${allAgentNames.join(', ')}`,
                isError: true,
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Failed to load custom agent "${agentType}": ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=sub-agent.js.map