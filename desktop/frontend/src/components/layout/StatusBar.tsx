import { useState, useEffect, useCallback, useRef } from 'react';
import { useModelStore } from '../../stores/model-store';
import { useChatStore } from '../../stores/chat-store';
import { useNextStore } from '../../stores/next-store';
import { useConfirmationStore } from '../../stores/confirmation-store';
import { useUIStore } from '../../stores/ui-store';
import { useQuestStore } from '../../stores/quest-store';
import { useRemoteStore } from '../../stores/remote-store';
import { useAutoUpdate } from '../../hooks/useAutoUpdate';
import { useTheme } from '../../contexts/ThemeContext';
import { RemoteMenu } from '../remote/RemoteMenu';
import type { GitStatus } from '../../ipc/ipc-client';
import { NextQuickSettings } from '../editor/NextQuickSettings';
import { SyncStatusBar } from '../sync/SyncStatusBar';
import { useIndexingStore, initIndexingProgressListener } from '../../stores/indexing-store';

export function StatusBar() {
  const { currentModel } = useModelStore();
  const { isStreaming } = useChatStore();
  const { enabled: nextEnabled, isGenerating: nextGenerating } = useNextStore();
  const pendingConfirmation = useConfirmationStore((s) => s.request);
  const { viewMode, setViewMode } = useUIStore();
  const questRunningCount = useQuestStore((s) => s.runningTaskIds.length);
  const questStreaming = useQuestStore((s) => s.isStreaming);
  const { activeTerminal } = useRemoteStore();
  const update = useAutoUpdate();
  const { toggleTheme, themeName } = useTheme();
  const [showRemoteMenu, setShowRemoteMenu] = useState(false);
  const [workspace, setWorkspace] = useState('');
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [showNextSettings, setShowNextSettings] = useState(false);
  const [indexStatus, setIndexStatus] = useState<{ indexed: boolean; indexedCount: number } | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const { currentProgress, isIndexing } = useIndexingStore();

  const [workflowStatus, setWorkflowStatus] = useState<{
    runningCount: number;
    batchProgress: string | null;
  }>({ runningCount: 0, batchProgress: null });

  const refresh = useCallback(async () => {
    try {
      const ws = await window.electronAPI.config.getWorkspace();
      setWorkspace(ws || '');
      const gs = await window.electronAPI.git.status();
      setGitStatus(gs);
      const idx = await window.electronAPI.indexing.status();
      setIndexStatus(idx ? { indexed: idx.indexed, indexedCount: idx.indexedCount } : null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 10 seconds
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Initialize global indexing progress listener (persists across component mounts)
  useEffect(() => {
    const cleanup = initIndexingProgressListener();
    return cleanup;
  }, []);

  useEffect(() => {
    const fetchWorkflowStatus = async () => {
      try {
        const status = await window.electronAPI?.workflow?.getStatus?.('');
        if (status) {
          setWorkflowStatus({
            runningCount: status.runningCount || 0,
            batchProgress: status.batchProgress || null,
          });
        }
      } catch (err) {
        console.error('Failed to fetch workflow status:', err);
      }
    };

    fetchWorkflowStatus();
    const interval = setInterval(fetchWorkflowStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Also refresh when streaming ends (files may have changed)
  useEffect(() => {
    if (!isStreaming) {
      const timer = setTimeout(refresh, 1000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, refresh]);

  const modelDisplay = currentModel
    ? currentModel.replace(/^ollama:/, '').replace(/^openai:/, '').replace(/^anthropic:/, '')
    : 'No model';

  const wsDisplay = workspace
    ? workspace.split(/[/\\]/).pop() || workspace
    : '';

  return (
    <div className="h-6 bg-gradient-to-r from-[#1a1a2e] to-[#16213e] flex items-center px-3 text-cp-text text-[11px] gap-3 select-none shrink-0 border-t border-white/[0.04]">
      {/* App name */}
      <span className="opacity-80">灵境</span>

      {/* Git branch */}
      {gitStatus?.isRepo && gitStatus.branch && (
        <span className="flex items-center gap-1 opacity-70">
          <GitBranchIcon />
          <span>{gitStatus.branch}</span>
          {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
            <span className="text-[9px] opacity-60">
              {gitStatus.ahead > 0 && `↑${gitStatus.ahead}`}
              {gitStatus.behind > 0 && `↓${gitStatus.behind}`}
            </span>
          )}
          {gitStatus.modified + gitStatus.staged + gitStatus.untracked > 0 && (
            <span className="text-[9px]">
              {gitStatus.staged > 0 && <span className="text-green-400">+{gitStatus.staged}</span>}
              {gitStatus.modified > 0 && <span className="text-yellow-400 ml-0.5">~{gitStatus.modified}</span>}
              {gitStatus.untracked > 0 && <span className="text-cp-text-dim ml-0.5">?{gitStatus.untracked}</span>}
            </span>
          )}
        </span>
      )}

      {/* Workspace folder */}
      {wsDisplay && (
        <span className="opacity-50 truncate max-w-[200px]" title={workspace}>
          {wsDisplay}
        </span>
      )}

      <div className="flex-1" />

      {/* Cloud Sync Status */}
      <SyncStatusBar />

      {/* Workflow Status */}
      {(workflowStatus.runningCount > 0 || workflowStatus.batchProgress) && (
        <button
          onClick={() => useUIStore.getState().setSidebarPanel('workflow')}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10 opacity-60 hover:opacity-90"
          title="工作流状态"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217 456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          </svg>
          {workflowStatus.runningCount > 0 && (
            <span className="text-cp-accent">工作流: {workflowStatus.runningCount}个运行中</span>
          )}
          {workflowStatus.batchProgress && (
            <span>批量: {workflowStatus.batchProgress}</span>
          )}
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10 opacity-60 hover:opacity-90"
        title={themeName === 'dark' ? '切换亮色主题' : '切换暗色主题'}
        aria-label={themeName === 'dark' ? '切换亮色主题' : '切换暗色主题'}
      >
        {themeName === 'dark' ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 003 12c0 4.97 4.03 9 9 9 .526 0 1.04-.05 1.54-.15a7 7 0 01-7.48-3.86 7 7 0 013.86-7.48z" />
          </svg>
        )}
      </button>

      {/* Quest Mode toggle */}
      <button
        onClick={() => setViewMode(viewMode === 'quest' ? 'editor' : 'quest')}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10 ${
          viewMode === 'quest' ? 'text-cp-accent' : 'opacity-40'
        }`}
        title={viewMode === 'quest' ? 'Quest Mode (Ctrl+Shift+Q)' : 'Switch to Quest Mode (Ctrl+Shift+Q)'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <span>Quest</span>
        {questRunningCount > 0 && (
          <span className="text-[9px] px-1 rounded-full bg-blue-500/30 text-blue-300">
            {questRunningCount}
          </span>
        )}
      </button>

      {/* NEXT indicator */}
      <div className="relative">
        <button
          ref={nextButtonRef}
          onClick={() => setShowNextSettings(!showNextSettings)}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10 ${
            nextGenerating
              ? 'text-cp-accent animate-pulse'
              : nextEnabled
                ? 'text-green-400 opacity-70'
                : 'opacity-30'
          }`}
          title={nextEnabled ? (nextGenerating ? 'NEXT: 正在生成...' : 'NEXT: 已启用') : 'NEXT: 已禁用'}
        >
          <NextIcon />
          <span>NEXT</span>
        </button>
        {showNextSettings && (
          <NextQuickSettings
            onClose={() => setShowNextSettings(false)}
            anchorRef={nextButtonRef}
          />
        )}
      </div>

      {/* Model */}
      <span className="opacity-50">{modelDisplay}</span>

      {/* SSH Connection Status - Clickable to open remote menu */}
      <div className="relative">
        <button
          onClick={() => setShowRemoteMenu(!showRemoteMenu)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
        >
          {activeTerminal ? (
            <>
              <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M14.25 3.104v5.714c0 .597.237 1.17.659 1.591L19 14.5" />
              </svg>
              <span className="text-green-400">SSH: {activeTerminal.username}@{activeTerminal.host}</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M14.25 3.104v5.714c0 .597.237 1.17.659 1.591L19 14.5M19.8 15.3l-1.402 1.402c1.285 1.286 1.285 3.37 0 4.656l-.47.47a3.288 3.288 0 01-4.656 0l-1.402-1.402M5 14.5l-1.402 1.402a3.288 3.288 0 000 4.656l.47.47c1.286 1.286 3.37 1.286 4.656 0L10.126 19.6M12 18v-3.75m0 0c-.251.023-.501.05-.75.082m.75-.082c.251.023.501.05.75.082" />
              </svg>
              <span>远程连接</span>
            </>
          )}
        </button>
        {showRemoteMenu && (
          <RemoteMenu
            activeTerminal={activeTerminal}
            onDisconnect={async () => {
              await useRemoteStore.getState().disconnect();
            }}
            onOpenFolder={() => {
              useUIStore.getState().setShowRemoteFolderPicker(true);
            }}
            onManageConnections={() => {
              useUIStore.getState().setSidebarPanel('remote');
              useRemoteStore.getState().setShowConnectionDialog(true);
            }}
            onClose={() => setShowRemoteMenu(false)}
          />
        )}
      </div>

      {/* Index status - shows live progress when indexing, static status otherwise */}
      {isIndexing && currentProgress ? (
        <button
          onClick={() => useUIStore.getState().setSidebarPanel('explorer')}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-cp-accent/15 text-cp-accent hover:bg-cp-accent/25 transition-colors animate-pulse"
          title={'索引进度: ' + currentProgress.message}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
          </svg>
          <span className="text-[10px]">
            {(currentProgress.phase === 'scanning' || currentProgress.phase === 'embedding' || currentProgress.phase === 'storing') && (
              <>索引: {currentProgress.processedFiles}/{currentProgress.totalFiles > 0 ? currentProgress.totalFiles : '?'}</>
            )}
            {currentProgress.phase === 'error' && '索引出错'}
          </span>
        </button>
      ) : indexStatus && (
        <span
          className={`flex items-center gap-1 ${indexStatus.indexed ? 'opacity-40' : 'text-cyan-400 opacity-70'}`}
          title={indexStatus.indexed ? `已索引 ${indexStatus.indexedCount} 个代码块` : '未索引'}
        >
          <IndexIcon />
          <span>{indexStatus.indexed ? indexStatus.indexedCount : '未索引'}</span>
        </span>
      )}

      {/* Update status */}
      {update.phase === 'available' && (
        <button
          onClick={update.downloadUpdate}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
          title={`下载 v${update.info?.version}`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          <span>下载 v{update.info?.version}</span>
        </button>
      )}
      {update.phase === 'downloading' && (
        <span className="text-cp-accent animate-pulse flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{update.progress?.percent}%</span>
        </span>
      )}
      {update.phase === 'downloaded' && (
        <button
          onClick={update.installUpdate}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
          title="重启并安装更新"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>重启安装 v{update.info?.version}</span>
        </button>
      )}

      {/* Status */}
      {pendingConfirmation ? (
        <span className="text-amber-400 animate-pulse flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          等待确认
        </span>
      ) : (
        <span className={`${isStreaming || questStreaming ? 'text-cp-accent animate-pulse' : 'opacity-50'}`}>
          {isStreaming ? 'Generating...' : questStreaming ? 'Quest running...' : 'Ready'}
        </span>
      )}
    </div>
  );
}

function GitBranchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
      <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function IndexIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}
