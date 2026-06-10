import { getPlanManager } from '../../../planning/plan-manager.js';
export const planCreateTool = {
    name: 'plan_create',
    description: 'Create a structured implementation plan for complex multi-step tasks. Use this before executing large-scale changes.',
    parameters: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'A clear, descriptive title for the plan',
            },
            description: {
                type: 'string',
                description: 'Brief description of the overall goal',
            },
            goals: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of specific, measurable goals',
            },
            constraints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of constraints or requirements',
            },
            steps: {
                type: 'array',
                description: 'Sequential steps to achieve the plan',
                items: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Concise step title' },
                        description: { type: 'string', description: 'Detailed description of what to do' },
                        files: { type: 'array', items: { type: 'string' }, description: 'File paths to create/modify' },
                        commands: { type: 'array', items: { type: 'string' }, description: 'Commands to run for verification' },
                        estimatedComplexity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Estimated complexity' },
                    },
                    required: ['title', 'description'],
                },
            },
        },
        required: ['title', 'description', 'goals', 'steps'],
    },
    async execute(params, context) {
        const planManager = getPlanManager();
        try {
            const plan = planManager.createPlan({
                title: params.title,
                description: params.description,
                goals: params.goals,
                constraints: params.constraints,
                steps: params.steps,
                workingDirectory: context.workingDirectory,
            });
            return {
                content: `Plan created successfully!\n\nPlan ID: ${plan.id}\nTitle: ${plan.title}\nSteps: ${plan.steps.length}\n\nPlease review the plan in the Planning Panel. Use plan ID "${plan.id}" to execute.`,
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Failed to create plan: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=plan-create.js.map