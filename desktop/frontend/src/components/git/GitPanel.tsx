import { useState, useEffect } from 'react';

interface GitFile {
  path: string;
  status: string;
  staged: boolean;
}

interface GitStatusData {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  modified: number;
  untracked: number;
  staged: number;
  files: GitFile[];
}

const statusIcon: Record<string, { char: string; color: string }> = {
  staged: { char: 'A', color: 'text-cp-success' },
  modified: { char: 'M', color: 'text-cp-warning' },
  untracked: { char: 'U', color: 'text-cp-text-dim' },
};

export function GitPanel() {
  const [status, setStatus] = useState<GitStatusData | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);

  const refresh = () => {
    window.electronAPI?.git?.status?.().then(setStatus).catch(() => {});
  };

  useEffect(() => { refresh(); }, []);

  const handleInitRepo = async () => {
    setInitializing(true);
    try { await window.electronAPI?.git?.init?.(); refresh(); } catch {} finally { setInitializing(false); }
  };

  const handleStageAll = async () => {
    await window.electronAPI?.git?.addAll?.();
    refresh();
  };

  const handleStageFile = async (path: string) => {
    await window.electronAPI?.git?.add?.([path]);
    refresh();
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    try {
      await window.electronAPI?.git?.commit?.(commitMsg.trim());
      setCommitMsg('');
      refresh();
    } catch {} finally { setCommitting(false); }
  };

  const stagedFiles = status?.files?.filter(f => f.staged) ?? [];
  const changedFiles = status?.files?.filter(f => !f.staged) ?? [];

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-cp-text-dim font-medium border-b border-cp-border flex items-center justify-between">
        <span>源代码管理</span>
        <button onClick={refresh} className="text-cp-text-dim/50 hover:text-cp-text transition-colors" title="刷新">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!status && <p className="text-xs text-cp-text-dim/40 text-center mt-8">加载中...</p>}

        {status && !status.isRepo && (
          <div className="text-center mt-8 space-y-3 px-3">
            <svg className="w-10 h-10 mx-auto text-cp-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 0v3.75m0-3.75V18M6.75 6.75h10.5a2.25 2.25 0 012.25 2.25v5.25a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 14.25V9a2.25 2.25 0 012.25-2.25z" />
            </svg>
            <p className="text-xs text-cp-text-dim/60">当前工作区不是 Git 仓库</p>
            <button onClick={handleInitRepo} disabled={initializing} className="px-3 py-1.5 text-xs bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 rounded transition-colors disabled:opacity-50">
              {initializing ? '初始化中...' : '初始化 Git 仓库'}
            </button>
          </div>
        )}

        {status && status.isRepo && (
          <div className="space-y-2">
            {/* Branch */}
            <div className="px-3 pt-2 flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-cp-text-dim shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v6m0 0a3 3 0 100 6 3 3 0 000-6zm0 6v6m-6-9a3 3 0 100-6 3 3 0 000 6zm0 0v3a3 3 0 003 3h3" />
              </svg>
              <span className="text-cp-text font-medium">{status.branch || 'HEAD'}</span>
              {status.ahead > 0 && <span className="text-cp-success text-[10px]">{status.ahead}↑</span>}
              {status.behind > 0 && <span className="text-cp-warning text-[10px]">{status.behind}↓</span>}
            </div>

            {/* Commit input */}
            <div className="px-3 space-y-1.5">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                  placeholder="提交信息"
                  className="flex-1 text-xs bg-cp-bg border border-cp-border rounded px-2 py-1 text-cp-text placeholder:text-cp-text-dim/40 focus:border-cp-accent focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleCommit(); }}
                />
                <button
                  onClick={handleCommit}
                  disabled={committing || !commitMsg.trim() || stagedFiles.length === 0}
                  className="px-2 py-1 text-[10px] bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 rounded disabled:opacity-30 transition-colors"
                  title="提交 (Ctrl+Enter)"
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Staged Changes */}
            {stagedFiles.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-cp-text-dim/60 font-medium flex items-center gap-1">
                  <span className="text-cp-success">●</span> 已暂存的更改 ({stagedFiles.length})
                </div>
                {stagedFiles.map(f => (
                  <div key={`s-${f.path}`} className="px-3 py-0.5 flex items-center text-xs hover:bg-cp-surfaceHover cursor-pointer group">
                    <span className={`w-4 text-center font-mono text-[10px] ${statusIcon[f.status]?.color || 'text-cp-text-dim'}`}>
                      {statusIcon[f.status]?.char || '?'}
                    </span>
                    <span className="text-cp-text truncate flex-1 ml-1">{f.path}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Changed / Untracked */}
            {changedFiles.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-cp-text-dim/60 font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="text-cp-warning">●</span> 更改 ({changedFiles.length})
                  </span>
                  <button onClick={handleStageAll} className="text-cp-accent hover:underline text-[10px]" title="全部暂存">+全部</button>
                </div>
                {changedFiles.map(f => (
                  <div key={`c-${f.path}`} className="px-3 py-0.5 flex items-center text-xs hover:bg-cp-surfaceHover cursor-pointer group">
                    <span className={`w-4 text-center font-mono text-[10px] ${statusIcon[f.status]?.color || 'text-cp-text-dim'}`}>
                      {statusIcon[f.status]?.char || '?'}
                    </span>
                    <span className="text-cp-text truncate flex-1 ml-1">{f.path}</span>
                    <button
                      onClick={() => handleStageFile(f.path)}
                      className="opacity-0 group-hover:opacity-100 text-cp-accent text-[10px] ml-1 transition-opacity"
                      title="暂存"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}

            {stagedFiles.length === 0 && changedFiles.length === 0 && (
              <p className="text-xs text-cp-text-dim/50 text-center py-4">没有更改</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
