import { useDiffReviewStore } from '../../stores/diff-review-store';

/**
 * Accept/Reject bar for multi-file edits during diff review.
 * Shows file count and bulk accept/reject actions.
 */
export function AcceptRejectBar() {
  const { fileChanges, acceptAll, rejectAll, finalizeReview } = useDiffReviewStore();

  const files = Object.values(fileChanges);
  const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'partial').length;
  if (files.length === 0) return null;

  const handleAcceptAll = () => {
    acceptAll();
    finalizeReview();
  };

  const handleRejectAll = () => {
    rejectAll();
    finalizeReview();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-cp-border/40 rounded-lg">
      <span className="text-[10px] text-cp-text-dim flex-1">
        {files.length} \u4e2a\u6587\u4ef6\u5df2\u4fee\u6539
        {pendingCount > 0 && <span className="text-yellow-400 ml-1">({pendingCount} \u5f85\u5904\u7406)</span>}
      </span>
      <button
        onClick={handleAcceptAll}
        className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-[10px] hover:bg-green-600/30 transition-colors"
      >
        \u5168\u90e8\u63a5\u53d7
      </button>
      <button
        onClick={handleRejectAll}
        className="px-2 py-0.5 bg-red-600/20 text-red-400 rounded text-[10px] hover:bg-red-600/30 transition-colors"
      >
        \u5168\u90e8\u64a4\u9500
      </button>
    </div>
  );
}

