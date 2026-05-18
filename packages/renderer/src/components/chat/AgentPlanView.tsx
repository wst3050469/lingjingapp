import React from 'react';
import { useAgentModeStore } from '../../stores/agent-mode-store';

export const AgentPlanView: React.FC = () => {
  const { plan, state } = useAgentModeStore();

  if (!plan) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">执行计划</h4>
        <span className="text-xs text-gray-500">{plan.completedSteps}/{plan.totalSteps}</span>
      </div>
      <div className="space-y-1">
        {plan.steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-gray-50 dark:bg-gray-800">
            <span className="text-gray-400 w-5">{idx + 1}.</span>
            <span className="flex-1">{step.description}</span>
            <StepStatusBadge status={step.status} />
            {step.isHighRisk && <span className="text-orange-500">⚠</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

const StepStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    pending: 'bg-gray-200 text-gray-600',
    running: 'bg-blue-200 text-blue-700',
    completed: 'bg-green-200 text-green-700',
    failed: 'bg-red-200 text-red-700',
    skipped: 'bg-gray-100 text-gray-400',
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] ${colors[status] ?? ''}`}>{status}</span>;
};
