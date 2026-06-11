import React from 'react';
import { useReviewStore } from '../../stores/review-store';
import { ReviewFindingCard } from './ReviewFindingCard';
import { ReviewRuleEditor } from './ReviewRuleEditor';

interface ReviewPanelProps {
  projectPath: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400', warning: 'text-yellow-400', info: 'text-blue-400', suggestion: 'text-gray-400',
};

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ projectPath }) => {
  const { currentReport, loading } = useReviewStore();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-sm font-medium text-gray-200">代码审查</h2>
        {loading && <span className="text-xs text-yellow-400">审查中...</span>}
      </div>
      {currentReport ? (
        <div className="flex-1 overflow-auto p-3 space-y-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-400">评分: <span className="text-green-400 font-bold">{currentReport.summary?.score}/100</span></span>
            <span className="text-gray-400">问题: {currentReport.findings?.length || 0}</span>
            <span className="text-gray-600">{currentReport.reviewerType}</span>
          </div>
          {(currentReport.findings || []).length === 0 ? (
            <div className="text-center text-green-400 text-sm py-8">审查通过，未发现问题</div>
          ) : (
            <div className="space-y-2">
              {(currentReport.findings || []).map((f: any, i: number) => (
                <ReviewFindingCard key={i} finding={f} projectPath={projectPath} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">尚未执行审查</div>
      )}
    </div>
  );
};
