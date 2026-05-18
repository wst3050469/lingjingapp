import React from 'react';
import type { ContextUsage } from '@codepilot/core/context';

interface ContextMeterBarProps {
  usage: ContextUsage;
}

export const ContextMeterBar: React.FC<ContextMeterBarProps> = ({ usage }) => {
  const percent = usage.utilizationPercent;
  const color = percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-orange-400' : 'bg-blue-500';

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span>{usage.usedTokens.toLocaleString()} / {usage.maxTokens.toLocaleString()}</span>
    </div>
  );
};
