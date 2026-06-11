import React, { useState, useEffect } from 'react';

interface ReviewReport {
  reviewId: string;
  originalMessageId: string;
  score: number;
  suggestions: string[];
  riskFlags: string[];
  reviewedAt: Date;
}

export const ReviewReportPanel: React.FC = () => {
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [selected, setSelected] = useState<ReviewReport | null>(null);

  const fetchReports = async () => {
    try {
      const result = await window.electronAPI?.invoke('fusion:review:reports') as ReviewReport[];
      setReports(result ?? []);
    } catch {}
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const scoreColor = (score: number): string => {
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">审查报告</h2>
        <button
          onClick={fetchReports}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          刷新
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {reports.map((report) => (
            <div
              key={report.reviewId}
              onClick={() => setSelected(report)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selected?.reviewId === report.reviewId
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{report.reviewId}</span>
                <span className={`text-lg font-bold ${scoreColor(report.score)}`}>{report.score.toFixed(1)}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {report.riskFlags.length} 风险 | {report.suggestions.length} 建议
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">暂无审查报告</div>
          )}
        </div>

        {selected && (
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">报告详情</h3>
              <span className={`text-2xl font-bold ${scoreColor(selected.score)}`}>{selected.score.toFixed(1)}</span>
            </div>
            {selected.riskFlags.length > 0 && (
              <div>
                <div className="text-xs font-medium text-red-600 mb-1">风险标记</div>
                <div className="flex flex-wrap gap-1">
                  {selected.riskFlags.map((flag, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 rounded">{flag}</span>
                  ))}
                </div>
              </div>
            )}
            {selected.suggestions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-blue-600 mb-1">改进建议</div>
                <ul className="space-y-1">
                  {selected.suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
