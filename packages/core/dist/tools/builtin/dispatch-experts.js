// dispatch_experts tool - parallel expert agent dispatch engine
import { Agent } from '../../agent/agent.js';
import { getExpertPreset, getExpertPresets } from '../../agents/presets.js';
import { getPrompt } from '../../agent/prompts.js';
// Module-level injected dependencies (same pattern as sub-agent)
let _provider = null;
let _parentRegistry = null;
export function initDispatchExpertsTool(provider, registry) {
    _provider = provider;
    _parentRegistry = registry;
}
const expertTypeNames = () => getExpertPresets().map(p => p.name);
export const dispatchExpertsTool = {
    name: 'dispatch_experts',
    description: `Dispatch multiple expert agents to work on tasks in parallel. ` +
        `Each expert runs independently with its own tools and context. ` +
        `Use dependsOn to create execution waves where later tasks wait for earlier ones. ` +
        `Available expert types: ${expertTypeNames().join(', ')}`,
    parameters: {
        type: 'object',
        properties: {
            tasks: {
                type: 'array',
                description: 'Array of expert tasks to dispatch',
                items: {
                    type: 'object',
                    properties: {
                        expertType: {
                            type: 'string',
                            description: `Expert type to dispatch. One of: ${expertTypeNames().join(', ')}`,
                        },
                        taskTitle: {
                            type: 'string',
                            description: 'Short title for the task (used in UI)',
                        },
                        taskDescription: {
                            type: 'string',
                            description: 'Detailed task description with file paths, requirements, and constraints',
                        },
                        dependsOn: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Task titles this task depends on (will wait for them to complete)',
                        },
                    },
                    required: ['expertType', 'taskTitle', 'taskDescription'],
                },
            },
            context: {
                type: 'string',
                description: 'Shared context information available to all experts (project structure, conventions, etc.)',
            },
        },
        required: ['tasks'],
    },
    async execute(params, context) {
        if (!_provider || !_parentRegistry) {
            return { content: 'Expert dispatch system not initialized', isError: true };
        }
        const tasks = params.tasks;
        const sharedContext = params.context ?? '';
        if (!tasks || tasks.length === 0) {
            return { content: 'No tasks provided to dispatch', isError: true };
        }
        // Validate all expert types
        for (const task of tasks) {
            const preset = getExpertPreset(task.expertType);
            if (!preset) {
                return {
                    content: `Unknown expert type: "${task.expertType}". Available: ${expertTypeNames().join(', ')}`,
                    isError: true,
                };
            }
        }
        // Assign unique IDs to tasks
        const taskMap = new Map();
        for (let i = 0; i < tasks.length; i++) {
            const id = `expert-${i}-${tasks[i].expertType}`;
            taskMap.set(tasks[i].taskTitle, { ...tasks[i], id });
        }
        // Emit dispatch start
        const taskSummaries = Array.from(taskMap.values()).map(t => ({
            id: t.id,
            expertType: t.expertType,
            title: t.taskTitle,
        }));
        emitEvent(context, { type: 'expert_dispatch_start', taskCount: tasks.length, tasks: taskSummaries });
        // Topological sort: resolve dependencies into execution waves
        const waves = resolveWaves(tasks, taskMap);
        // Execute waves sequentially, tasks within each wave in parallel
        const results = new Map();
        let succeeded = 0;
        let failed = 0;
        for (const wave of waves) {
            const wavePromises = wave.map(async (taskTitle) => {
                const task = taskMap.get(taskTitle);
                const preset = getExpertPreset(task.expertType);
                emitEvent(context, {
                    type: 'expert_task_start',
                    taskId: task.id,
                    expertType: task.expertType,
                    title: task.taskTitle,
                });
                try {
                    const result = await runExpertAgent(task, preset, sharedContext, context, results);
                    results.set(task.taskTitle, {
                        title: task.taskTitle,
                        expertType: task.expertType,
                        result,
                        isError: false,
                    });
                    succeeded++;
                    emitEvent(context, {
                        type: 'expert_task_end',
                        taskId: task.id,
                        expertType: task.expertType,
                        title: task.taskTitle,
                        result,
                        isError: false,
                    });
                }
                catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    results.set(task.taskTitle, {
                        title: task.taskTitle,
                        expertType: task.expertType,
                        result: msg,
                        isError: true,
                    });
                    failed++;
                    emitEvent(context, {
                        type: 'expert_task_end',
                        taskId: task.id,
                        expertType: task.expertType,
                        title: task.taskTitle,
                        result: msg,
                        isError: true,
                    });
                }
            });
            await Promise.allSettled(wavePromises);
        }
        emitEvent(context, { type: 'expert_dispatch_end', totalTasks: tasks.length, succeeded, failed });
        // Build structured result report
        const report = buildReport(results, tasks.length, succeeded, failed);
        return { content: report };
    },
};
async function runExpertAgent(task, preset, sharedContext, parentContext, previousResults) {
    if (!_provider || !_parentRegistry)
        throw new Error('Not initialized');
    // Build expert-specific tool registry
    const subTools = _parentRegistry.getSubset(preset.allowedTools);
    // Load and compose system prompt
    let systemPrompt = getPrompt(preset.systemPromptFile);
    systemPrompt += `\n\nYou are a ${preset.name} expert agent. Complete the assigned task thoroughly and return your findings/results.`;
    if (sharedContext) {
        systemPrompt += `\n\n## Shared Project Context\n${sharedContext}`;
    }
    // Include results from dependencies
    if (task.dependsOn && task.dependsOn.length > 0) {
        const depResults = [];
        for (const depTitle of task.dependsOn) {
            const dep = previousResults.get(depTitle);
            if (dep) {
                depResults.push(`### ${dep.title} (${dep.expertType})\n${dep.result}`);
            }
        }
        if (depResults.length > 0) {
            systemPrompt += `\n\n## Results from Dependent Tasks\n${depResults.join('\n\n')}`;
        }
    }
    // Create and run the expert agent
    const agent = new Agent({
        provider: _provider,
        tools: subTools,
        systemPrompt,
        maxTurns: preset.maxTurns,
        workingDirectory: parentContext.workingDirectory,
        onEvent: (event) => {
            // Forward text events as progress
            if (event.type === 'text') {
                emitEvent(parentContext, {
                    type: 'expert_task_progress',
                    taskId: task.id,
                    expertType: task.expertType,
                    text: event.text,
                });
            }
        },
    });
    return await agent.run(`## Task: ${task.taskTitle}\n\n${task.taskDescription}`, parentContext.signal);
}
function emitEvent(context, event) {
    context.onExpertEvent?.(event);
}
/**
 * Resolve task dependencies into execution waves using topological sort.
 * Wave 0 = tasks with no dependencies, Wave 1 = depends on Wave 0, etc.
 */
function resolveWaves(tasks, taskMap) {
    const resolved = new Set();
    const waves = [];
    const remaining = new Set(tasks.map(t => t.taskTitle));
    let safetyCounter = 0;
    const maxIterations = tasks.length + 1;
    while (remaining.size > 0 && safetyCounter < maxIterations) {
        safetyCounter++;
        const wave = [];
        for (const title of remaining) {
            const task = taskMap.get(title);
            const deps = task.dependsOn ?? [];
            const allDepsResolved = deps.every(d => resolved.has(d));
            if (allDepsResolved) {
                wave.push(title);
            }
        }
        if (wave.length === 0) {
            // Circular dependency detected - force remaining tasks into last wave
            wave.push(...remaining);
        }
        for (const title of wave) {
            remaining.delete(title);
            resolved.add(title);
        }
        waves.push(wave);
    }
    return waves;
}
function buildReport(results, total, succeeded, failed) {
    const lines = [
        `# Expert Dispatch Report`,
        ``,
        `**Total**: ${total} | **Succeeded**: ${succeeded} | **Failed**: ${failed}`,
        ``,
    ];
    for (const [, r] of results) {
        const statusIcon = r.isError ? '[FAILED]' : '[OK]';
        lines.push(`## ${statusIcon} ${r.title} (${r.expertType})`);
        lines.push('');
        lines.push(r.result);
        lines.push('');
        lines.push('---');
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=dispatch-experts.js.map