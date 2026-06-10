// FileChangeSummary - compact list of changed files shown in chat sidebar after agent completes

import { useDiffReviewStore } from '../../stores/diff-review-store';

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-400',
  accepted: 'bg-green-400',
  rejected: 'bg-red-400',
  partial: 'bg-orange-400',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '\u5f85\u5904\u7406',
  accepted: '\u5df2\u63a5\u53d7',
  rejected: '\u5df2\u62d2\u7edd',
  partial: '\u90e8\u5206\u5904\u7406',
};

export function FileChangeSummary() {
  const {
    fileChanges, setActiveReviewFile,
    acceptAll, rejectAll, finalizeReview,
  } = useDiffReviewStore();

  const files = Object.values(fileChanges);
  if (files.length === 0) return null;

  return (
    <div className="bg-white/[0.03] border border-cp-border/40 rounded-lg p-2 space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-cp-text-dim font-medium">
          \u6587\u4ef6\u53d8\u66f4 ({files.length})
        </span>
      </div>

      {/* File list */}
      <div className="space-y-0.5">
        {files.map((fc) => (
          <button
            key={fc.filePath}
            onClick={() => setActiveReviewFile(fc.filePath)}
            className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[10px] text-left
              hover:bg-white/5 transition-colors group"
            title={fc.filePath}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[fc.status] || STATUS_DOT.pending}`} />
            <span className="text-cp-text truncate flex-1">{fc.fileName}</span>
            {fc.isNewFile && <span className="text-green-400 text-[9px] shrink-0">new</span>}
            <span className="text-cp-text-dim/50 text-[9px] shrink-0">
              {STATUS_LABEL[fc.status] || STATUS_LABEL.pending}
            </span>
            <span className="text-cp-accent/60 text-[9px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              View
            </span>
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-cp-border/30">
        <button
          onClick={() => { acceptAll(); finalizeReview(); }}
          className="flex-1 px-2 py-0.5 bg-green-600/15 text-green-400 rounded text-[10px] hover:bg-green-600/25 transition-colors"
        >
          \u5168\u90e8\u63a5\u53d7
        </button>
        <button
          onClick={() => { rejectAll(); finalizeReview(); }}
          className="flex-1 px-2 py-0.5 bg-red-600/15 text-red-400 rounded text-[10px] hover:bg-red-600/25 transition-colors"
        >
          \u5168\u90e8\u64a4\u9500
        </button>
      </div>
    </div>
  );
}
