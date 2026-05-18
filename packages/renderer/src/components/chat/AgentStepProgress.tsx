import React from 'react';
import { useAgentModeStore } from '../../stores/agent-mode-store';

export const AgentStepProgress: React.FC = () => {
  const { plan, stepProgress } = useAgentModeStore();

  if (!plan) return null;

  return (
    <div className="space-y-1">
      {plan.steps
        .filter(s => s.status === 'running' || s.status === 'completed' || s.status === 'failed')
        .map(step => {
          const progress = stepProgress.get(step.id);
          return (
            <div key={step.id} className="text-xs p-1.5 rounded border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1">
                <span className={step.status === 'running' ? 'text-blue-500' : step.status === 'completed' ? 'text-green-500' : 'text-red-500'}>
                  {step.status === 'running' ? '●' : step.status === 'completed' ? '✓' : '✗'}
                </span>
                <span className="flex-1 truncate">{step.description}</span>
                {step.completedAt && step.startedAt && (
                  <span className="text-gray-400">
                    {Math.round((new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000)}s
                  </span>
                )}
              </div>
              {progress?.output && (
                <pre className="mt-1 text-[10px] text-gray-500 max-h-20 overflow-y-auto">{progress.output}</pre>
              )}
            </div>
          );
        })}
    </div>
  );
};
