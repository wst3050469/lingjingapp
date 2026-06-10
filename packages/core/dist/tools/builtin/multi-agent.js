import { Agent } from '../../agent/agent.js';
let _provider = null;
let _parentRegistry = null;
export function initMultiAgentTool(provider, registry) {
    _provider = provider;
    _parentRegistry = registry;
}
export const multiAgentTool = {
    name: 'multi_agent',
    description: 'Coordinate multiple agents to work collaboratively on complex tasks. Supports dependencies, parallel execution, and result aggregation.',
    parameters: {
        type: 'object',
        properties: {
            agents: {
                type: 'array',
                description: 'Array of agent tasks to execute',
                items: {
                    type: 'object',
                    properties: {
                        agentId: {
                            type: 'string',
                            description: 'Unique identifier for this agent instance',
                        },
                        task: {
                            type: 'string',
                            description: 'Task description for this agent',
                        },
                        dependencies: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Agent IDs that must complete before this agent starts',
                        },
                        timeout: {
                            type: 'number',
                            description: 'Timeout in seconds for this agent. Default: 300',
                        },
                        retryCount: {
                            type: 'number',
                            description: 'Number of retries on failure. Default: 0',
                        },
                    },
                    required: ['agentId', 'task'],
                },
            },
            strategy: {
                type: 'string',
                enum: ['parallel', 'sequential', 'dag'],
                description: 'Execution strategy: parallel (all at once), sequential (one by one), dag (respect dependencies). Default: dag',
            },
            aggregateResults: {
                type: 'boolean',
                description: 'Whether to aggregate and summarize results from all agents. Default: true',
            },
            sharedContext: {
                type: 'string',
                description: 'Context shared across all agents',
            },
        },
        required: ['agents'],
    },
    async execute(params, context) {
        if (!_provider || !_parentRegistry) {
            return { content: 'Multi-agent system not initialized', isError: true };
        }
        const agents = params.agents;
        const strategy = params.strategy || 'dag';
        const aggregateResults = params.aggregateResults !== false;
        const sharedContext = params.sharedContext || '';
        const results = new Map();
        for (const agent of agents) {
            results.set(agent.agentId, {
                agentId: agent.agentId,
                status: 'pending',
            });
        }
        const executeAgent = async (agentTask) => {
            const startTime = Date.now();
            const result = {
                agentId: agentTask.agentId,
                status: 'running',
            };
            try {
                const enrichedTask = sharedContext
                    ? `${agentTask.task}\n\nShared Context:\n${sharedContext}`
                    : agentTask.task;
                if (agentTask.dependencies && agentTask.dependencies.length > 0) {
                    const depResults = [];
                    for (const depId of agentTask.dependencies) {
                        const depResult = results.get(depId);
                        if (depResult && depResult.status === 'success' && depResult.output) {
                            depResults.push(`[${depId}]: ${depResult.output}`);
                        }
                    }
                    if (depResults.length > 0) {
                        result.status = 'running';
                    }
                }
                const agent = new Agent({
                    provider: _provider,
                    tools: _parentRegistry.getSubset([
                        'file_read', 'file_write', 'file_edit', 'glob', 'grep', 'bash',
                    ]),
                    systemPrompt: `You are agent ${agentTask.agentId}. Complete your assigned task independently and provide clear, actionable results.`,
                    maxTurns: 30,
                    workingDirectory: context.workingDirectory,
                });
                const output = await agent.run(enrichedTask);
                result.status = 'success';
                result.output = output || 'Task completed successfully';
                result.duration = Date.now() - startTime;
            }
            catch (err) {
                result.status = 'failed';
                result.error = err.message;
                result.duration = Date.now() - startTime;
            }
            return result;
        };
        const canExecute = (agentTask) => {
            if (!agentTask.dependencies || agentTask.dependencies.length === 0) {
                return true;
            }
            return agentTask.dependencies.every(depId => {
                const depResult = results.get(depId);
                return depResult && depResult.status === 'success';
            });
        };
        if (strategy === 'parallel') {
            const promises = agents.map(agent => executeAgent(agent));
            const agentResults = await Promise.all(promises);
            for (const result of agentResults) {
                results.set(result.agentId, result);
            }
        }
        else if (strategy === 'sequential') {
            for (const agent of agents) {
                const result = await executeAgent(agent);
                results.set(result.agentId, result);
            }
        }
        else {
            let remaining = [...agents];
            while (remaining.length > 0) {
                const ready = remaining.filter(a => canExecute(a));
                if (ready.length === 0) {
                    const failed = remaining.filter(a => a.dependencies && a.dependencies.some(depId => {
                        const depResult = results.get(depId);
                        return depResult && depResult.status === 'failed';
                    }));
                    if (failed.length > 0) {
                        for (const agent of failed) {
                            results.set(agent.agentId, {
                                agentId: agent.agentId,
                                status: 'failed',
                                error: 'Dependency failed',
                            });
                        }
                        remaining = remaining.filter(a => !failed.includes(a));
                        continue;
                    }
                    break;
                }
                const promises = ready.map(agent => executeAgent(agent));
                const agentResults = await Promise.all(promises);
                for (const result of agentResults) {
                    results.set(result.agentId, result);
                }
                remaining = remaining.filter(a => !ready.includes(a));
            }
        }
        let output = `## Multi-Agent Execution Report\n\n`;
        output += `**Strategy**: ${strategy}\n`;
        output += `**Total Agents**: ${agents.length}\n\n`;
        const successful = Array.from(results.values()).filter(r => r.status === 'success');
        const failed = Array.from(results.values()).filter(r => r.status === 'failed');
        output += `### Summary\n`;
        output += `- ✅ Successful: ${successful.length}\n`;
        output += `- ❌ Failed: ${failed.length}\n\n`;
        if (successful.length > 0) {
            output += `### Successful Agents\n`;
            for (const result of successful) {
                output += `\n**${result.agentId}** (${result.duration}ms)\n`;
                if (aggregateResults && result.output) {
                    const lines = result.output.split('\n').slice(0, 10);
                    output += '```\n' + lines.join('\n') + '\n```\n';
                }
            }
        }
        if (failed.length > 0) {
            output += `\n### Failed Agents\n`;
            for (const result of failed) {
                output += `- **${result.agentId}**: ${result.error}\n`;
            }
        }
        return {
            content: output,
            isError: failed.length > 0,
        };
    },
};
//# sourceMappingURL=multi-agent.js.map