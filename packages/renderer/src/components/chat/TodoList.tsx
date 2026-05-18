import { useState } from 'react';

interface TodoItem {
  text: string;
  checked: boolean;
  // Optional extended status from agent todo system
  status?: 'pending' | 'in_progress' | 'completed';
}

interface TodoListProps {
  items: TodoItem[];
}

export function TodoList({ items }: TodoListProps) {
  const [checks, setChecks] = useState<boolean[]>(() => items.map((i) => i.checked));

  const toggle = (index: number) => {
    setChecks((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  return (
    <div className="space-y-1 my-2">
      {items.map((item, i) => {
        const status = item.status || (checks[i] ? 'completed' : 'pending');
        return (
          <label key={i} className="flex items-start gap-2 cursor-pointer group">
            {status === 'in_progress' ? (
              <svg className="w-3.5 h-3.5 text-cp-accent mt-0.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : status === 'completed' ? (
              <svg className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggle(i)}
                className="mt-0.5 accent-cp-accent cursor-pointer"
              />
            )}
            <span
              className={`text-xs ${
                status === 'completed'
                  ? 'text-cp-text-dim/50 line-through'
                  : status === 'in_progress'
                  ? 'text-cp-text'
                  : 'text-cp-text'
              }`}
            >
              {item.text}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Parse text content for todo items.
 * Supports multiple formats:
 *   - [ ] Pending task       (dash/bullet checkbox)
 *   1. [x] Completed task    (numbered checkbox — agent todo tool format)
 *   2. [>] In progress task  (numbered in-progress — agent todo tool format)
 *
 * Returns null if no items found, or the parsed items array.
 */
export function parseTodoItems(content: string): TodoItem[] | null {
  const lines = content.split('\n');
  const items: TodoItem[] = [];

  for (const line of lines) {
    // Match: "- [ ] text", "* [x] text", "1. [x] text", "2. [>] text"
    // Prefix: optional whitespace, optional bullet/dash/asterisk, optional number+dot
    const match = line.match(/^[\s]*(?:[-*]|\d+\.)\s*\[([ xX>])\]\s*(.+)/);
    if (match) {
      const marker = match[1];
      const text = match[2].trim();

      if (marker === '>') {
        items.push({ checked: false, text, status: 'in_progress' });
      } else if (marker === ' ' || marker === 'x' || marker === 'X') {
        items.push({
          checked: marker !== ' ',
          text,
          status: marker !== ' ' ? 'completed' : 'pending',
        });
      }
    }
  }

  return items.length > 0 ? items : null;
}
