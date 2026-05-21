import { getPlanManager } from '../../../planning/plan-manager.js';
export const planStepCompleteTool = {
    name: 'plan_step_complete',
    description: 'Mark the current step as completed and move to the next step.',
    parameters: {
        type: 'object',
        properties: {
            planId: {
                type: 'string',
                description: 'The ID of the plan',
            },
            result: {
                type: 'string',
                description: 'Summary of what was accomplished in this step',
            },
        },
        required: ['planId', 'result'],
    },
    async execute(params, context) {
        const planManager = getPlanManager();
        try {
            const planId = params.planId;
            const result = params.result;
            const plan = planManager.getPlan(planId);
            if (!plan) {
                return { content: `Plan not found: ${planId}`, isError: true };
            }
            const stepIndex = plan.currentStepIndex;
            planManager.updateStepStatus(planId, stepIndex, 'completed', result);
            planManager.advanceStep(planId);
            const nextStep = plan.steps[plan.currentStepIndex];
            if (nextStep) {
                return {
                    content: `Step completed: ${plan.steps[stepIndex].title}\n\nNext step: ${nextStep.title}`,
                };
            }
            else {
                // All steps completed
                planManager.setPlanStatus(planId, 'completed');
                return {
                    content: `All steps completed! Plan finished.\n\nCall plan_retrospective to provide a summary.`,
                };
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Failed to complete step: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=plan-step-complete.js.map