// Todo management tool - track tasks with status
// Global todo list (shared across agent turns)
let todoList = [];
export function getTodoList() {
    return todoList;
}
export function formatTodoList() {
    if (todoList.length === 0)
        return '(No tasks)';
    return todoList
        .map((item, i) => {
        const icon = item.status === 'completed' ? '[x]' : item.status === 'in_progress' ? '[>]' : '[ ]';
        return `${i + 1}. ${icon} ${item.content}`;
    })
        .join('\n');
}
export const todoTool = {
    name: 'todo',
    description: 'Manage a task list to track progress. Use to create, update, and track tasks during complex operations.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action: "set" to replace entire list, "list" to show current tasks',
                enum: ['set', 'list'],
            },
            todos: {
                type: 'string',
                description: 'JSON array of todo items for "set" action. Each item: { "content": "...", "status": "pending|in_progress|completed" }',
            },
        },
        required: [],
    },
    async execute(params) {
        // Auto-detect action: if todos provided → 'set', otherwise → 'list'
        const action = params.action || (params.todos ? 'set' : 'list');
        switch (action) {
            case 'set': {
                const todosJson = params.todos;
                if (!todosJson) {
                    return { content: 'Error: "todos" parameter required for "set" action', isError: true };
                }
                try {
                    const items = JSON.parse(todosJson);
                    todoList = items;
                    return { content: `Updated todo list:\n${formatTodoList()}` };
                }
                catch (e) {
                    return { content: `Error parsing todos JSON: ${e}`, isError: true };
                }
            }
            case 'list':
                return { content: formatTodoList() };
            default:
                return { content: `Unknown action: ${action}`, isError: true };
        }
    },
};
//# sourceMappingURL=todo.js.map