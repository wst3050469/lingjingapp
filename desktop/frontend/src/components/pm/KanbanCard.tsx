import React from 'react';

interface KanbanCardProps {
  item: any;
}

const TYPE_ICONS: Record<string, string> = { task: '📋', bug: '🐛', feature: '✨', story: '📖', epic: '🏔️' };
const PRIORITY_COLORS: Record<string, string> = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-gray-400' };

export const KanbanCard: React.FC<KanbanCardProps> = ({ item }) => {
  return (
    <div className="bg-gray-800 rounded p-2 border border-gray-700 hover:border-gray-500 cursor-pointer">
      <div className="flex items-start gap-1.5">
        <span className="text-xs">{TYPE_ICONS[item.type] || '📋'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-200 truncate">{item.title}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={`text-[10px] ${PRIORITY_COLORS[item.priority] || 'text-gray-400'}`}>{item.priority}</span>
            {item.assignee && <span className="text-[10px] text-gray-500">@{item.assignee}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
