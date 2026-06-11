import React, { useEffect } from 'react';
import { useCheckpointStore } from '../../stores/checkpoint-store';

export const CheckpointPanel: React.FC = () => {
  const { checkpoints, selectedId, isRollingBack, lastRollbackResult, loadCheckpoints, selectCheckpoint, rollback } = useCheckpointStore();

  useEffect(() => { loadCheckpoints(); }, [loadCheckpoints]);

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-700 w-72">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold">检查点历史</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {checkpoints.map((cp) => (
          <div
            key={cp.id}
            onClick={() => selectCheckpoint(cp.id)}
            className={`p-2 rounded cursor-pointer text-xs ${
              selectedId === cp.id ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <div className="font-medium truncate">{cp.description}</div>
            <div className="text-gray-500 mt-1">
              {new Date(cp.timestamp ?? cp.createdAt).toLocaleString()} · {cp.files.length} 文件
            </div>
          </div>
        ))}
      </div>
      {selectedId && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button
            onClick={() => rollback(selectedId, 'preserve-manual-edits')}
            disabled={isRollingBack}
            className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isRollingBack ? '回滚中...' : '回滚（保留手动修改）'}
          </button>
          <button
            onClick={() => rollback(selectedId, 'force')}
            disabled={isRollingBack}
            className="w-full px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            强制回滚
          </button>
        </div>
      )}
      {lastRollbackResult && (
        <div className={`p-2 text-xs ${lastRollbackResult.success ? 'text-green-600' : 'text-orange-600'}`}>
          {lastRollbackResult.message}
        </div>
      )}
    </div>
  );
};
