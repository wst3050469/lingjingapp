import React from 'react';
import type { IntentMode } from '@codepilot/core/intent';

interface IntentModeIndicatorProps {
  mode: IntentMode;
  confidence: number;
}

const modeConfig: Record<IntentMode, { label: string; icon: string; color: string }> = {
  coding: { label: '编码', icon: '✏️', color: 'bg-green-500' },
  browsing: { label: '浏览', icon: '👁️', color: 'bg-blue-500' },
  debugging: { label: '调试', icon: '🐛', color: 'bg-orange-500' },
};

export const IntentModeIndicator: React.FC<IntentModeIndicatorProps> = ({ mode, confidence }) => {
  const config = modeConfig[mode];
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
      <span>{config.icon}</span>
      <span className="font-medium">{config.label}</span>
      <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
        <div
          className={`h-full ${config.color} rounded-full`}
          style={{ width: `${confidence * 100}%` }}
        />
      </div>
    </div>
  );
};
