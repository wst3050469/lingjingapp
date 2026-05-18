import React from 'react';

interface TaskNodeProps {
  task: any;
}

export const TaskNode: React.FC<TaskNodeProps> = ({ task }) => {
  return (
    <div className="flex items-center gap-2 p-2 border border-gray-700 rounded text-sm">
      <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">{task.type}</span>
      <span className="text-gray-200 flex-1">{task.name}</span>
      <code className="text-xs text-gray-400 font-mono truncate max-w-[200px]">{task.command}</code>
      {task.timeout && <span className="text-xs text-gray-600">{Math.round(task.timeout / 1000)}s</span>}
    </div>
  );
};
