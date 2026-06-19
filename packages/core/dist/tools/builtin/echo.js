export const echoTool = {
    name: 'echo',
    description: 'Echoes back the provided input string.',
    parameters: {
        type: 'object',
        properties: {
            message: {
                type: 'string',
                description: 'The message to echo back',
            },
        },
        required: ['message'],
    },
    async execute(params, context) {
        const message = String(params.message ?? '');
        return {
            content: message,
        };
    },
};
//# sourceMappingURL=echo.js.map