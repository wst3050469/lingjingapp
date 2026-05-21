import { getPlanManager } from '../../../planning/plan-manager.js';
export const planUpdateTool = {
    name: 'plan_update',
    description: 'Update an existing plan (status, steps, or content). Used during review or execution adjustments.',
    parameters: {
        type: 'object',
        properties: {
            planId: {
                type: 'string',
                description: 'The ID of the plan to update',
            },
            updates: {
                type: 'object',
                description: 'Fields to update (title, description, goals, constraints, steps, status)',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    goals: { type: 'array', items: { type: 'string' } },
                    constraints: { type: 'array', items: { type: 'string' } },
                    steps: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                description: { type: 'string' },
                                files: { type: 'array', items: { type: 'string' } },
                                commands: { type: 'array', items: { type: 'string' } },
                            },
                        },
                    },
                    status: { type: 'string', enum: ['draft', 'reviewing', 'approved', 'executing', 'paused', 'completed', 'cancelled'] },
                },
            },
        },
        required: ['planId', 'updates'],
    },
    async execute(params, context) {
        const planManager = getPlanManager();
        try {
            const planId = params.planId;
            const updates = params.updates;
            const plan = planManager.updatePlan(planId, updates);
            return {
                content: `Plan updated successfully.\n\nStatus: ${plan.status}\nUpdated: ${new Date(plan.updatedAt).toLocaleString()}`,
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Failed to update plan: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=plan-update.js.map