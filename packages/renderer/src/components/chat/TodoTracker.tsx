import { useState } from 'react';
import { useTodoStore, type TodoItem } from '../../stores/todo-store';

export function TodoTracker() {
  const items = useTodoStore((s) => s.items);
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const completed = items.filter((i) => i && i.status === 'completed').length;
  const total = items.length;

  return (
    <div className="bg-white/[0.02] border border-cp-border/40 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg 
            className={`w-3 h-3 text-cp-text-dim/60 transition-transform ${collapsed ? '' : 'rotate-90'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-cp-text font-medium">待办</span>
        </div>
        <span className="text-cp-text-dim/60">{completed}/{total} 已完成</span>
      </button>

      {/* Items */}
      {!collapsed && (
        <div className="border-t border-cp-border/30 divide-y divide-cp-border/20">
          {items.map((item, i) => (
            <TodoItemRow key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function TodoItemRow({ item }: { item: TodoItem }) {
  return (
    <div className="flex items-start gap-2 px-3 py-1.5">
      {item.status === 'completed' ? (
        <svg className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : item.status === 'in_progress' ? (
        <svg className="w-3.5 h-3.5 text-cp-accent mt-0.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <div className="w-3.5 h-3.5 mt-0.5 shrink-0 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full border border-cp-text-dim/30" />
        </div>
      )}
      <span
        className={`text-xs leading-relaxed flex-1 ${
          item.status === 'completed'
            ? 'text-cp-text-dim/50 line-through'
            : item.status === 'in_progress'
            ? 'text-cp-text'
            : 'text-cp-text-dim/70'
        }`}
      >
        {item.content}
      </span>
    </div>
  );
}
