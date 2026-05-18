import React from 'react';
import { usePMStore } from '../../stores/pm-store';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  projectPath: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectPath }) => {
  const { boardColumns, workItems } = usePMStore();

  return (
    <div className="flex gap-3 p-3 h-full overflow-x-auto">
      {boardColumns.map((col: any) => {
        const items = workItems.filter((wi: any) => wi.status === col.status);
        return <KanbanColumn key={col.id} column={col} items={items} projectPath={projectPath} />;
      })}
    </div>
  );
};
