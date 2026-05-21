import { getPlanManager } from '../../../planning/plan-manager.js';
export const planRetrospectiveTool = {
    name: 'plan_retrospective',
    description: 'Provide a summary and retrospective after plan completion. Call this after all steps are done.',
    parameters: {
        type: 'object',
        properties: {
            planId: {
                type: 'string',
                description: 'The ID of the completed plan',
            },
            summary: {
                type: 'string',
                description: 'What was accomplished',
            },
            deviations: {
                type: 'string',
                description: 'Any deviations from the original plan',
            },
            verificationResults: {
                type: 'string',
                description: 'Test results, build status, or other verification',
            },
            followUpSuggestions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Suggestions for follow-up work',
            },
        },
        required: ['planId', 'summary'],
    },
    async execute(params, context) {
        const planManager = getPlanManager();
        try {
            const planId = params.planId;
            const summary = params.summary;
            const plan = planManager.getPlan(planId);
            if (!plan) {
                return { content: `Plan not found: ${planId}`, isError: true };
            }
            const retrospective = [
                '## Retrospective',
                '',
                '### What was accomplished',
                summary,
                '',
            ];
            if (params.deviations) {
                retrospective.push('### Deviations from original plan');
                retrospective.push(params.deviations);
                retrospective.push('');
            }
            if (params.verificationResults) {
                retrospective.push('### Verification Results');
                retrospective.push(params.verificationResults);
                retrospective.push('');
            }
            const followUps = params.followUpSuggestions;
            if (followUps && followUps.length > 0) {
                retrospective.push('### Follow-up Suggestions');
                followUps.forEach((s, i) => retrospective.push(`${i + 1}. ${s}`));
                retrospective.push('');
            }
            planManager.updatePlan(planId, { retrospective: retrospective.join('\n') });
            return {
                content: retrospective.join('\n') + '\n✅ Plan completed successfully!',
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Failed to create retrospective: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=plan-retrospective.js.map