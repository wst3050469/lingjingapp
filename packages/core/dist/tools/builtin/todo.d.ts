import type { Tool } from '../types.js';
export interface TodoItem {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}
export declare function getTodoList(): TodoItem[];
export declare function formatTodoList(): string;
export declare const todoTool: Tool;
//# sourceMappingURL=todo.d.ts.map