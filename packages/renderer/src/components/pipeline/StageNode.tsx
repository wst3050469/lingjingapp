import React from 'react';

interface StageNodeProps {
  stage: any;
  onEdit?: (stage: any) => void;
}

export const StageNode: React.FC<StageNodeProps> = ({ stage, onEdit }) => {
  return (
    <div className="border border-gray-600 rounded-lg p-3 bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-200">{stage.name}</span>
        <span className="text-xs text-gray-500">顺序: {stage.order}</span>
      </div>
      <div className="space-y-1">
        {(stage.tasks || []).map((task: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-400 bg-gray-900/50 rounded px-2 py-1">
            <span className="text-blue-400">{task.type}</span>
            <span className="flex-1 truncate">{task.name}</span>
            <span className="text-gray-600">{task.command}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
