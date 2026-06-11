import React from 'react';
import type { FixSuggestion } from '@codepilot/core/auto-fix';

interface AutoFixActionButtonProps {
  suggestion: FixSuggestion;
  onApply: (fixId: string) => void;
  onReject: (fixId: string) => void;
}

export const AutoFixActionButton: React.FC<AutoFixActionButtonProps> = ({ suggestion, onApply, onReject }) => {
  return (
    <div className="inline-flex items-center gap-1 ml-2">
      <button
        onClick={() => onApply(suggestion.id)}
        className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200"
        title={suggestion.fixDescription}
      >
        AI修复
      </button>
    </div>
  );
};
