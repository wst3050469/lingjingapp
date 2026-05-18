import React from 'react';
import type { TerminalSuggestion } from '@codepilot/core/terminal-suggester';

interface TerminalSuggestionCardProps {
  suggestion: TerminalSuggestion;
  onExecute: (command: string) => void;
}

const riskColors: Record<string, string> = {
  safe: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  caution: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  dangerous: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export const TerminalSuggestionCard: React.FC<TerminalSuggestionCardProps> = ({ suggestion, onExecute }) => {
  const [confirmed, setConfirmed] = React.useState(false);

  const handleExecute = () => {
    if (suggestion.riskLevel === 'dangerous' && !confirmed) {
      setConfirmed(true);
      return;
    }
    onExecute(suggestion.command);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{suggestion.command}</code>
        <span className={`text-xs px-1.5 py-0.5 rounded ${riskColors[suggestion.riskLevel]}`}>{suggestion.riskLevel}</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">{suggestion.description}</p>
      {suggestion.estimatedTime && <p className="text-xs text-gray-500">预估时间: {suggestion.estimatedTime}</p>}
      {confirmed && <p className="text-xs text-red-500 font-medium">⚠ 此操作有风险，确认执行？</p>}
      <button onClick={handleExecute} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
        {confirmed ? '确认执行' : '执行'}
      </button>
    </div>
  );
};
