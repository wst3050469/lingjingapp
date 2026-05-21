import { getPlanManager } from '../../../planning/plan-manager.js';
export const planStepBlockedTool = {
    name: 'plan_step_blocked',
    description: 'Mark the current step as blocked due to an issue. Use when you cannot proceed without user direction.',
    parameters: {
        type: 'object',
        properties: {
            planId: {
                type: 'string',
                description: 'The ID of the plan',
            },
            reason: {
                type: 'string',
                description: 'Clear explanation of why the step is blocked',
            },
            suggestions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Suggested alternatives or workarounds',
            },
        },
        required: ['planId', 'reason'],
    },
    async execute(params, context) {
        const planManager = getPlanManager();
        try {
            const planId = params.planId;
            const reason = params.reason;
            const plan = planManager.getPlan(planId);
            if (!plan) {
                return { content: `Plan not found: ${planId}`, isError: true };
            }
            const stepIndex = plan.currentStepIndex;
            planManager.updateStepStatus(planId, stepIndex, 'blocked', undefined, reason);
            const suggestions = params.suggestions || [];
            const suggestionsText = suggestions.length > 0
                ? `\n\nSuggestions:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
                : '';
            return {
                content: `Step blocked: ${plan.steps[stepIndex].title}\n\nReason: ${reason}${suggestionsText}\n\nWaiting for user direction.`,
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Failed to mark step as blocked: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=plan-step-blocked.js.map