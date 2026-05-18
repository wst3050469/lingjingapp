import React from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';

interface PipelineHistoryProps {
  projectPath: string;
  pipelineId: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'text-green-400', failed: 'text-red-400', running: 'text-yellow-400',
  pending: 'text-gray-400', cancelled: 'text-gray-500', queued: 'text-blue-400',
};

export const PipelineHistory: React.FC<PipelineHistoryProps> = ({ projectPath, pipelineId }) => {
  const { runHistory, loadRunHistory } = usePipelineStore();

  React.useEffect(() => { loadRunHistory(projectPath, pipelineId); }, [projectPath, pipelineId]);

  return (
    <div className="mt-2">
      <h3 className="text-xs text-gray-400 font-medium mb-1">执行历史</h3>
      {runHistory.length === 0 ? (
        <div className="text-xs text-gray-600">暂无执行记录</div>
      ) : (
        <div className="space-y-1 max-h-32 overflow-auto">
          {runHistory.map((run: any) => (
            <div key={run.id} className="flex items-center gap-2 text-xs bg-gray-800/50 rounded px-2 py-1">
              <span className={STATUS_COLORS[run.status] || 'text-gray-400'}>{run.status}</span>
              <span className="text-gray-500">{run.trigger_type}</span>
              {run.duration_ms && <span className="text-gray-600">{run.duration_ms}ms</span>}
              <span className="text-gray-600 ml-auto">{run.created_at?.slice(0, 19)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
