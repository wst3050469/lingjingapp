import React from 'react';

interface ReviewFindingCardProps {
  finding: any;
  projectPath: string;
}

const SEVERITY_STYLES: Record<string, { icon: string; color: string }> = {
  critical: { icon: '🔴', color: 'text-red-400' },
  warning: { icon: '🟡', color: 'text-yellow-400' },
  info: { icon: '🔵', color: 'text-blue-400' },
  suggestion: { icon: '💡', color: 'text-gray-400' },
};

export const ReviewFindingCard: React.FC<ReviewFindingCardProps> = ({ finding }) => {
  const style = SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.info;

  return (
    <div className="border border-gray-700 rounded-lg p-3 hover:border-gray-500">
      <div className="flex items-start gap-2">
        <span className="text-sm">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${style.color}`}>{finding.severity}</span>
            <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">{finding.dimension}</span>
            <span className="text-xs text-gray-500">{finding.ruleName}</span>
          </div>
          <div className="text-sm text-gray-300 mb-1">{finding.message}</div>
          <div className="text-xs text-gray-500">
            <span className="text-blue-400">{finding.filePath}</span>
            <span>:{finding.line}</span>
          </div>
          {finding.suggestion && (
            <div className="mt-1 text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1">
              💡 {finding.suggestion}
            </div>
          )}
          {finding.codeSnippet && (
            <pre className="mt-1 text-xs text-gray-500 bg-gray-900 rounded p-1.5 overflow-auto font-mono">{finding.codeSnippet}</pre>
          )}
        </div>
      </div>
    </div>
  );
};
