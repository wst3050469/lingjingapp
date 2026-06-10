import { getPlanManager } from '../../../planning/plan-manager.js';
export const planExecuteTool = {
    name: 'plan_execute',
    description: 'Start executing an approved plan step-by-step. Call this after the user approves the plan.',
    parameters: {
        type: 'object',
        properties: {
            planId: {
                type: 'string',
                description: 'The ID of the plan to execute',
            },
        },
        required: ['planId'],
    },
    async execute(params, context) {
        const planManager = getPlanManager();
        try {
            const planId = params.planId;
            const plan = planManager.getPlan(planId);
            if (!plan) {
                return { content: `Plan not found: ${planId}`, isError: true };
            }
            if (plan.status !== 'approved') {
                return {
                    content: `Plan must be approved before execution. Current status: ${plan.status}`,
                    isError: true,
                };
            }
            planManager.setPlanStatus(planId, 'executing');
            return {
                content: `Plan execution started.\n\nTitle: ${plan.title}\nTotal steps: ${plan.steps.length}\n\nStarting step 1: ${plan.steps[0]?.title}`,
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Failed to start execution: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=plan-execute.js.map