// Ask User tool - ask the user a question during execution
export const askUserTool = {
    name: 'ask_user',
    description: 'Ask the user a question to get clarification or make a decision. Use when you need input from the user during task execution.',
    parameters: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: 'The question to ask the user',
            },
        },
        required: ['question'],
    },
    async execute(params, context) {
        const question = params.question;
        if (!context.askUser) {
            return { content: 'Cannot ask user - no interactive input available', isError: true };
        }
        try {
            const answer = await context.askUser(question);
            return { content: `User response: ${answer}` };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Error asking user: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=ask-user.js.map