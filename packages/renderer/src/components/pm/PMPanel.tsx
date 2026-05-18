import React, { useState } from 'react';
import { usePMStore } from '../../stores/pm-store';
import { KanbanBoard } from './KanbanBoard';
import { WorkItemForm } from './WorkItemForm';
import { MilestonePanel } from './MilestonePanel';

interface PMPanelProps {
  projectPath: string;
}

export const PMPanel: React.FC<PMPanelProps> = ({ projectPath }) => {
  const { loading, loadBoard } = usePMStore();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'board' | 'milestones'>('board');

  React.useEffect(() => { loadBoard(projectPath); }, [projectPath]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-gray-200">项目管理</h2>
          <div className="flex text-xs">
            <button className={`px-2 py-0.5 rounded-l ${activeTab === 'board' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'}`} onClick={() => setActiveTab('board')}>看板</button>
            <button className={`px-2 py-0.5 rounded-r ${activeTab === 'milestones' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'}`} onClick={() => setActiveTab('milestones')}>里程碑</button>
          </div>
        </div>
        <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500" onClick={() => setShowForm(true)}>新建工作项</button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? <div className="p-4 text-gray-400 text-sm">加载中...</div> : (
          activeTab === 'board' ? <KanbanBoard projectPath={projectPath} /> : <MilestonePanel projectPath={projectPath} />
        )}
      </div>
      {showForm && (
        <WorkItemForm projectPath={projectPath} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
};
