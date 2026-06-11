import React, { useState } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';
import { StageNode } from './StageNode';
import { TriggerConfig } from './TriggerConfig';
import { PipelineRunView } from './PipelineRunView';
import { PipelineHistory } from './PipelineHistory';

interface PipelineEditorProps {
  projectPath: string;
}

export const PipelineEditor: React.FC<PipelineEditorProps> = ({ projectPath }) => {
  const { pipelines, loading, loadPipelines, triggerPipeline } = usePipelineStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  React.useEffect(() => { loadPipelines(projectPath); }, [projectPath]);

  if (loading) return <div className="p-4 text-gray-400">加载中...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-sm font-medium text-gray-200">CI/CD 流水线</h2>
        <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">新建流水线</button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {pipelines.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">暂无流水线，点击"新建流水线"开始</div>
        ) : pipelines.map((p: any) => (
          <div key={p.id} className="border border-gray-700 rounded-lg p-3 hover:border-gray-500 cursor-pointer" onClick={() => setSelectedId(p.id)}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200">{p.name}</span>
              <div className="flex gap-2">
                <button className="text-xs text-green-400 hover:text-green-300" onClick={(e) => { e.stopPropagation(); triggerPipeline(projectPath, p.id); }}>运行</button>
              </div>
            </div>
            {selectedId === p.id && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <PipelineRunView projectPath={projectPath} pipelineId={p.id} />
                <PipelineHistory projectPath={projectPath} pipelineId={p.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
