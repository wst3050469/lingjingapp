import React from 'react';
import { usePMStore } from '../../stores/pm-store';

interface MilestonePanelProps {
  projectPath: string;
}

const STATUS_LABELS: Record<string, string> = { planned: '规划中', active: '进行中', completed: '已完成' };
const STATUS_COLORS: Record<string, string> = { planned: 'text-gray-400', active: 'text-blue-400', completed: 'text-green-400' };

export const MilestonePanel: React.FC<MilestonePanelProps> = ({ projectPath }) => {
  const { milestones, loadMilestones } = usePMStore();

  React.useEffect(() => { loadMilestones(projectPath); }, [projectPath]);

  return (
    <div className="p-3 space-y-2">
      <h3 className="text-xs text-gray-400 font-medium">里程碑</h3>
      {milestones.length === 0 ? (
        <div className="text-xs text-gray-600">暂无里程碑</div>
      ) : (
        milestones.map((ms: any) => (
          <div key={ms.id} className="border border-gray-700 rounded p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200">{ms.name}</span>
              <span className={`text-xs ${STATUS_COLORS[ms.status] || 'text-gray-400'}`}>{STATUS_LABELS[ms.status] || ms.status}</span>
            </div>
            {ms.dueDate && <div className="text-xs text-gray-500 mt-1">截止: {ms.dueDate}</div>}
          </div>
        ))
      )}
    </div>
  );
};
