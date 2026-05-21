// Plan tool - submit execution plans for user review
export const planTool = {
    name: 'plan',
    description: 'Submit an execution plan for user review before proceeding with significant changes. ' +
        'Use this when you are about to make multi-step modifications, refactors, or feature implementations. ' +
        'The plan will be shown to the user for approval before you proceed.',
    parameters: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'A short title for the plan',
            },
            steps: {
                type: 'string',
                description: 'The plan steps in markdown format. Include file paths, changes to make, and rationale.',
            },
        },
        required: ['title', 'steps'],
    },
    async execute(params) {
        // Default implementation (when not wrapped with confirmation).
        // When wrapped, the wrapper handles user approval flow.
        const title = params.title;
        return { content: `Plan "${title}" approved. Proceeding with execution.` };
    },
};
//# sourceMappingURL=plan.js.map