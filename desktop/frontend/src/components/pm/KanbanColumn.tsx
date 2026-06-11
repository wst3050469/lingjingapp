import React from 'react';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  column: any;
  items: any[];
  projectPath: string;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, items, projectPath }) => {
  const wipExceeded = column.wipLimit && items.length >= column.wipLimit;

  return (
    <div className="flex-shrink-0 w-64 bg-gray-800/30 rounded-lg">
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-300">{column.name}</span>
        <span className={`text-xs ${wipExceeded ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
          {items.length}{column.wipLimit ? `/${column.wipLimit}` : ''}
        </span>
      </div>
      {wipExceeded && <div className="px-2 py-1 text-xs text-red-400 bg-red-900/20">WIP超限!</div>}
      <div className="p-2 space-y-2 overflow-auto max-h-[calc(100%-40px)]">
        {items.map((item: any) => <KanbanCard key={item.id} item={item} />)}
      </div>
    </div>
  );
};
