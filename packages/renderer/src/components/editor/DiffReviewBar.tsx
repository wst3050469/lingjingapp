// DiffReviewBar - horizontal file navigation strip for diff review mode
// Shows changed files as pills with status indicators and bulk actions

import { useState } from 'react';
import { useDiffReviewStore } from '../../stores/diff-review-store';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-400',
  accepted: 'bg-green-400',
  rejected: 'bg-red-400',
  partial: 'bg-orange-400',
};

export function DiffReviewBar() {
  const {
    fileChanges, activeReviewFile, setActiveReviewFile,
    acceptFile, rejectFile, acceptAll, rejectAll, finalizeReview,
  } = useDiffReviewStore();
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);

  const files = Object.values(fileChanges);
  if (files.length === 0) return null;

  const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'partial').length;

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-cp-sidebar border-b border-cp-border overflow-x-auto shrink-0">
      {/* Summary label */}
      <span className="text-[10px] text-cp-text-dim whitespace-nowrap mr-1">
        Review ({files.length} files)
      </span>

      {/* File pills */}
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
        {files.map((fc) => {
          const isActive = fc.filePath === activeReviewFile;
          return (
            <div
              key={fc.filePath}
              className="relative"
              onMouseEnter={() => setHoveredFile(fc.filePath)}
              onMouseLeave={() => setHoveredFile(null)}
            >
              <button
                onClick={() => setActiveReviewFile(fc.filePath)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors
                  ${isActive
                    ? 'bg-white/10 text-cp-text'
                    : 'text-cp-text-dim hover:bg-white/5 hover:text-cp-text'
                  }`}
                title={fc.filePath}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[fc.status] || STATUS_COLORS.pending}`} />
                {fc.fileName}
                {fc.isNewFile && <span className="text-green-400 text-[9px]">+</span>}
              </button>

              {/* Hover popover with per-file actions */}
              {hoveredFile === fc.filePath && (
                <div className="absolute top-full left-0 mt-0.5 z-50 bg-cp-panel border border-cp-border rounded shadow-lg p-1.5 flex items-center gap-1"
                  onMouseEnter={() => setHoveredFile(fc.filePath)}
                  onMouseLeave={() => setHoveredFile(null)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); acceptFile(fc.filePath); }}
                    className="px-1.5 py-0.5 bg-green-600/15 text-green-400 rounded text-[9px] hover:bg-green-600/30 transition-colors"
                  >
                    {'\u2713'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); rejectFile(fc.filePath); }}
                    className="px-1.5 py-0.5 bg-red-600/15 text-red-400 rounded text-[9px] hover:bg-red-600/30 transition-colors"
                  >
                    {'\u2717'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-1 ml-1 shrink-0">
        <button
          onClick={acceptAll}
          className="px-2 py-0.5 bg-green-600/15 text-green-400 rounded text-[10px] hover:bg-green-600/25 transition-colors whitespace-nowrap"
          title="Accept all changes in all files"
        >
          {'\u2713'} All
        </button>
        <button
          onClick={rejectAll}
          className="px-2 py-0.5 bg-red-600/15 text-red-400 rounded text-[10px] hover:bg-red-600/25 transition-colors whitespace-nowrap"
          title="Reject all changes in all files"
        >
          {'\u2717'} All
        </button>
        <button
          onClick={finalizeReview}
          className={`px-2 py-0.5 rounded text-[10px] transition-colors whitespace-nowrap
            ${pendingCount === 0
              ? 'bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30'
              : 'bg-white/5 text-cp-text-dim hover:bg-white/10'
            }`}
          title={pendingCount > 0 ? `${pendingCount} files still pending` : 'Apply all decisions'}
        >
          Done
        </button>
      </div>
    </div>
  );
}
