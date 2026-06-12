import { useState, useEffect } from 'react';
import { useIndexingStore } from '../../../stores/indexing-store';

interface IndexingTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

interface IndexStatus {
  indexed: boolean;
  fileCount: number;
  indexedCount: number;
  lastUpdated: string | null;
  workspace: string;
}

interface IndexProgress {
  phase: string;
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  processedChunks: number;
  message: string;
  fileError?: string;
}

export function IndexingTab({ config, saveKey }: IndexingTabProps) {
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);

  // Sync building state with global indexing store on mount
  useEffect(() => {
    if (storeIsIndexing) {
      setBuilding(true);
    }
  }, []);

  const [buildError, setBuildError] = useState<string | null>(null);
  const [showIgnoreEditor, setShowIgnoreEditor] = useState(false);
  const [ignoreContent, setIgnoreContent] = useState('');
  const [ignoreExists, setIgnoreExists] = useState(false);
  const [savingIgnore, setSavingIgnore] = useState(false);
  const { currentProgress: liveProgress, isIndexing: storeIsIndexing } = useIndexingStore();

  const autoIndex = config?.indexing?.autoIndex ?? true;
  const ignorePatterns: string[] = config?.indexing?.ignorePatterns ?? [];

  useEffect(() => { loadStatus(); }, []);

  // Auto file watcher: start/stop based on autoIndex config
  useEffect(() => {
    if (autoIndex) {
      window.electronAPI.indexing?.startWatcher?.().catch(() => {});
    } else {
      window.electronAPI.indexing?.stopWatcher?.().catch(() => {});
    }
    return () => {
      // Don't stop on unmount — watcher persists across tab switches
    };
  }, [autoIndex]);

  // Reset building state when global store reports indexing complete
  useEffect(() => {
    if (!storeIsIndexing) {
      setBuilding(false);
      loadStatus();
    }
  }, [storeIsIndexing]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const s = await window.electronAPI.indexing.status();
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBuild = async () => {
    setBuilding(true);
    setBuildError(null);

    try {
      const res = await window.electronAPI.indexing.build();
      if (!res.success) {
        setBuildError(res.error || '索引创建失败，请检查配置与日志');
        setBuilding(false);
      }
      // On success, progress callback 'done' phase will reset building + loadStatus
    } catch (err) {
      setBuildError('索引请求异常: ' + (err instanceof Error ? err.message : String(err)));
      setBuilding(false);
    }
  };

  const handleOpenIgnoreEditor = async () => {
    const res = await window.electronAPI.indexing.getIgnore();
    setIgnoreContent(res.content);
    setIgnoreExists(res.exists);
    setShowIgnoreEditor(true);
  };

  const handleSaveIgnore = async () => {
    setSavingIgnore(true);
    try {
      await window.electronAPI.indexing.setIgnore(ignoreContent);
      setIgnoreExists(true);
      setShowIgnoreEditor(false);
    } finally {
      setSavingIgnore(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const formatFileCount = (count: number) => {
    if (count > 100000) return '100,000+';
    return count.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <p className="text-[11px] text-cp-text-dim/50 leading-relaxed">
        代码库索引可增强上下文理解能力，从而提供更准确的答复。支持 workspace 级别的跨工程索引。
      </p>

      {/* Index status card */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm text-cp-text font-medium">代码库索引</h4>
          {status?.indexed ? (
            <span className="flex items-center gap-1.5 text-[11px] text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              索引构建已完成
            </span>
          ) : (
            <span className="text-[11px] text-cp-text-dim/40">未索引</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-cp-accent/30 border-t-cp-accent rounded-full animate-spin" />
          </div>
        ) : status ? (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-[10px] text-cp-text-dim/40 mb-1">工作区文件</p>
                <p className="text-lg text-cp-text font-medium">{formatFileCount(status.fileCount)}</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-[10px] text-cp-text-dim/40 mb-1">已索引文件</p>
                <p className="text-lg text-cp-text font-medium">{formatFileCount(status.indexedCount)}</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-[10px] text-cp-text-dim/40 mb-1">最近更新</p>
                <p className="text-sm text-cp-text font-medium mt-0.5">{formatDate(status.lastUpdated)}</p>
              </div>
            </div>

            {/* Live indexing progress (real-time during build) */}
            {building && liveProgress && (
              <div className="space-y-2">
                {/* Phase indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-cp-text-dim/40">
                    {liveProgress.phase === 'scanning' && '扫描文件中...'}
                    {liveProgress.phase === 'embedding' && '嵌入向量中...'}
                    {liveProgress.phase === 'storing' && '存储索引中...'}
                    {liveProgress.phase === 'error' && '索引出错'}
                  </span>
                  <span className="text-[10px] text-cp-text-dim/50">
                    {liveProgress.phase === 'scanning' && `${liveProgress.processedFiles} 个文件`}
                    {(liveProgress.phase === 'embedding' || liveProgress.phase === 'storing') && (
                      `${Math.min(Math.round((liveProgress.processedFiles / Math.max(liveProgress.totalFiles, 1)) * 100), 100)}%`
                    )}
                  </span>
                </div>
                {/* Progress bar for embedding/storing */}
                {(liveProgress.phase === 'embedding' || liveProgress.phase === 'storing') && liveProgress.totalFiles > 0 && (
                  <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cp-accent rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((liveProgress.processedFiles / liveProgress.totalFiles) * 100, 100)}%` }}
                    />
                  </div>
                )}
                {/* Progress message */}
                <p className="text-[10px] text-cp-text-dim/50 truncate max-w-full">{liveProgress.message}</p>
              </div>
            )}

            {/* Static progress bar (from status) - only show when not building */}
            {!building && status.indexed && status.fileCount > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-cp-text-dim/40">索引进度</span>
                  <span className="text-[10px] text-cp-text-dim/50">
                    {Math.min(Math.round((status.indexedCount / status.fileCount) * 100), 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500/60 rounded-full transition-all"
                    style={{ width: `${Math.min((status.indexedCount / status.fileCount) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Workspace path */}
            {status.workspace && (
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-cp-text-dim/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <span className="text-[11px] text-cp-text-dim/40 font-mono truncate">{status.workspace}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              {!status.indexed ? (
                <button onClick={handleBuild} disabled={building}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-cp-accent text-cp-text hover:bg-cp-accent/80 disabled:opacity-50 transition-colors">
                  {building ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      构建中...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      创建索引
                    </>
                  )}
                </button>
              ) : (
                <button onClick={handleBuild} disabled={building}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border border-cp-border/40 text-cp-text-dim hover:text-cp-text hover:border-cp-border/60 disabled:opacity-50 transition-colors">
                  {building ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-cp-text-dim/30 border-t-white rounded-full animate-spin" />
                      更新中...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                      更新
                    </>
                  )}
                </button>
              )}

              {status.fileCount > 100000 && (
                <span className="text-[10px] text-amber-400/60">
                  文件数超过 100,000，索引可能需要较长时间
                </span>
              )}
            </div>

            {/* Error message */}
            {buildError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div className="text-xs text-red-300/90 leading-relaxed">{buildError}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-xs text-cp-text-dim/40">无法获取索引状态，请先设置工作区</p>
          </div>
        )}
      </div>

      {/* Auto indexing toggle */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm text-cp-text font-medium mb-1">自动更新</h4>
            <p className="text-[11px] text-cp-text-dim/40 leading-relaxed">
              自动为文件数量少于 {(config?.indexing?.autoIndexThreshold ?? 10000).toLocaleString()} 的代码库创建并更新索引
            </p>
          </div>
          <button
            onClick={() => saveKey('indexing.autoIndex', !autoIndex)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ml-4 ${
              autoIndex ? 'bg-green-500' : 'bg-white/10'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              autoIndex ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`} />
          </button>
        </div>
      </div>

      {/* Index exclusions */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <h4 className="text-sm text-cp-text font-medium mb-1">索引排除</h4>

        {/* Ignore files */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-cp-text-dim/60">忽略文件</p>
              <p className="text-[11px] text-cp-text-dim/35 mt-0.5 leading-relaxed">
                指定需要从索引中排除的文件和文件夹。默认已包含 <code className="text-cp-text-dim/50 bg-white/[0.04] px-1 rounded">.gitignore</code> 文件中列出的内容
              </p>
            </div>
            <button onClick={handleOpenIgnoreEditor}
              className="text-xs px-3 py-1.5 rounded-md border border-cp-border/40 text-cp-text-dim hover:text-cp-text hover:border-cp-border/60 transition-colors shrink-0 ml-4">
              管理
            </button>
          </div>

          {/* Display current ignore patterns from config */}
          {ignorePatterns.length > 0 && !showIgnoreEditor && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ignorePatterns.map((p, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-cp-text-dim/50 font-mono border border-cp-border/20">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ignore editor */}
        {showIgnoreEditor && (
          <div className="mt-3 bg-white/[0.03] border border-cp-accent/30 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-cp-text font-medium">
                .lingjingignore
                {!ignoreExists && <span className="text-cp-text-dim/40 font-normal ml-2">(新建)</span>}
              </p>
            </div>

            <textarea
              value={ignoreContent}
              onChange={(e) => setIgnoreContent(e.target.value)}
              placeholder={'# 排除模式示例\nconfig.json\ndist/\n*.log\n**/logs\n!app/'}
              rows={10}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent resize-none leading-relaxed"
            />

            {/* Pattern reference */}
            <div className="bg-cp-bg/50 rounded-lg p-3">
              <p className="text-[10px] text-cp-text-dim/40 mb-2 font-medium">模式参考</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  { pattern: 'config.json', desc: '忽略指定文件' },
                  { pattern: 'dist/', desc: '忽略整个目录' },
                  { pattern: '*.log', desc: '忽略所有 .log 文件' },
                  { pattern: '**/logs', desc: '忽略任意层级 logs 目录' },
                  { pattern: '!app/', desc: '排除取消 (保留该路径)' },
                ].map(({ pattern, desc }) => (
                  <div key={pattern} className="flex items-center gap-2">
                    <code className="text-[10px] text-cp-accent/70 bg-white/[0.03] px-1 rounded shrink-0">{pattern}</code>
                    <span className="text-[10px] text-cp-text-dim/30 truncate">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowIgnoreEditor(false)}
                className="text-xs text-cp-text-dim hover:text-cp-text px-3 py-1.5">
                取消
              </button>
              <button onClick={handleSaveIgnore} disabled={savingIgnore}
                className="text-xs px-4 py-1.5 bg-cp-accent text-cp-text rounded-md hover:bg-cp-accent/80 disabled:opacity-50 transition-colors">
                {savingIgnore ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-white/[0.02] border border-cp-border/30 rounded-xl p-4">
        <p className="text-xs text-cp-text-dim/50 font-medium mb-3">说明</p>
        <div className="space-y-2">
          {[
            { q: '索引支持多大的代码库？', a: '支持最多 100,000 个文件。文件数少于 10,000 时默认自动索引，更大的代码库需手动创建。' },
            { q: '哪些文件会被排除？', a: '默认排除 .gitignore 中列出的文件，以及 .lingjingignore 中的自定义模式。' },
            { q: '源代码会被上传吗？', a: '不会。索引在本地完成，源代码不会存储到远程服务器。' },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-[11px] text-cp-text-dim/60 font-medium">{q}</p>
              <p className="text-[11px] text-cp-text-dim/35 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
