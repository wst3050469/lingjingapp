// Todo store - real-time tracking of agent todo list
import { create } from 'zustand';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface TodoState {
  items: TodoItem[];
  setItems: (items: TodoItem[]) => void;
  clear: () => void;
}

export const useTodoStore = create<TodoState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  clear: () => set({ items: [] }),
}));
