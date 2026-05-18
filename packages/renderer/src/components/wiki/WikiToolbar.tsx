// WikiToolbar - header bar with title, language toggle, generate/update buttons, close

import { useWikiStore } from '../../stores/wiki-store';
import { useUIStore } from '../../stores/ui-store';

export function WikiToolbar() {
  const { status, isGenerating, isUpdating, changedModules, generate, update, abort, detectChanges, loadStatus, loadToc } = useWikiStore();
  const toggleWikiPanel = useUIStore((s) => s.toggleWikiPanel);

  const busy = isGenerating || isUpdating;
  const hasWiki = status?.hasWiki ?? false;
  const hasChanges = changedModules.length > 0;

  const handleGenerate = () => {
    if (busy) {
      abort();
    } else {
      generate();
    }
  };

  const handleUpdate = () => {
    if (busy) {
      abort();
    } else {
      update();
    }
  };

  const handleRefresh = async () => {
    await loadStatus();
    await loadToc();
    await detectChanges();
    // If changes detected, trigger auto-update
    const store = useWikiStore.getState();
    if (store.changedModules.length > 0 && !store.isUpdating && !store.isGenerating) {
      store.update();
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-cp-border/40 bg-cp-sidebar shrink-0">
      {/* Left: title */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-cp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <span className="text-sm font-medium text-cp-text">Repo Wiki</span>
        {status?.language && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-cp-text-dim">
            {status.language === 'zh' ? '中文' : 'EN'}
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={busy}
          title="刷新状态"
          className="p-1.5 rounded hover:bg-white/10 text-cp-text-dim hover:text-white transition-colors disabled:opacity-30"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>

        {/* Generate or Update button */}
        {!hasWiki ? (
          <button
            onClick={handleGenerate}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              busy
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30'
            }`}
          >
            {busy ? '取消' : '生成 Wiki'}
          </button>
        ) : (
          <>
            {hasChanges && (
              <button
                onClick={handleUpdate}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  busy
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                }`}
              >
                {busy ? '取消' : `更新 (${changedModules.length})`}
              </button>
            )}
            <button
              onClick={handleGenerate}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                busy
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/[0.06] text-cp-text-dim hover:bg-white/10 hover:text-white border border-cp-border/30'
              }`}
            >
              {busy ? '取消' : '重新生成'}
            </button>
          </>
        )}

        {/* Close button */}
        <button
          onClick={toggleWikiPanel}
          title="关闭"
          className="p-1.5 rounded hover:bg-white/10 text-cp-text-dim hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
