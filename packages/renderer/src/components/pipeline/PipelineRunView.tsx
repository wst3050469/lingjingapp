import React from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';

interface PipelineRunViewProps {
  projectPath: string;
  pipelineId: string;
}

const STATUS_ICON: Record<string, string> = {
  pending: '⏳', running: '▶️', success: '✅', failed: '❌', skipped: '⏭️', cancelled: '🚫', queued: '📋',
};

export const PipelineRunView: React.FC<PipelineRunViewProps> = ({ projectPath, pipelineId }) => {
  const { currentRun, logs, cancelPipeline } = usePipelineStore();

  return (
    <div className="space-y-2">
      {currentRun && (
        <div className="border border-gray-700 rounded p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-300">运行状态: {STATUS_ICON[currentRun.status] || ''} {currentRun.status}</span>
            {currentRun.status === 'running' && (
              <button className="text-xs text-red-400 hover:text-red-300" onClick={() => cancelPipeline(projectPath, currentRun.id)}>取消</button>
            )}
          </div>
          {(currentRun.stagesResult || []).map((stage: any, i: number) => (
            <div key={i} className="ml-2 mb-1">
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <span>{STATUS_ICON[stage.status] || ''}</span>
                <span>{stage.stageName}</span>
                {stage.durationMs && <span className="text-gray-600">({stage.durationMs}ms)</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded p-2 max-h-40 overflow-auto font-mono text-xs text-gray-400 space-y-0.5">
          {logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}
    </div>
  );
};
