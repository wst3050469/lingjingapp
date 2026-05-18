import { useState, useEffect } from 'react';
import { useAutoUpdate, UpdateState } from '../../../hooks/useAutoUpdate';
import { useUIStore } from '../../../stores/ui-store';

/* --- Helper components --- */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-xs font-medium text-cp-text-dim/70 uppercase tracking-wider">{title}</h4>
      <div className="flex-1 h-px bg-cp-border/20" />
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 mr-4">
        <p className="text-sm text-cp-text">{title}</p>
        {description && <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-green-500' : 'bg-white/10'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

function Divider() {
  return <div className="border-t border-cp-border/15" />;
}

function UpdateStatusBadge({ state }: { state: UpdateState }) {
  if (state.phase === 'checking') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">检查中</span>;
  }
  if (state.phase === 'downloading') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">下载中 {state.progress?.percent}%</span>;
  }
  if (state.phase === 'available') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">v{state.info?.version} 可用</span>;
  }
  if (state.phase === 'updated') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">已是最新</span>;
  }
  if (state.phase === 'downloaded') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">已就绪</span>;
  }
  if (state.phase === 'error') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">错误</span>;
  }
  return null;
}

/* --- Types --- */

interface AdvancedTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
  saving: string | null;
  showStatus: (msg: string) => void;
  onConfigReset: () => void;
}

/* --- Main Component --- */

export function AdvancedTab({ config, saveKey, saving, showStatus, onConfigReset }: AdvancedTabProps) {
  const adv = config?.advanced || {};
  
  // 主题切换
  const { theme, toggleTheme } = useUIStore();

  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('');

  // Auto-update hook
  const update = useAutoUpdate();

  // Proxy
  const [proxy, setProxy] = useState<string>(adv.proxy ?? '');
  const [proxyEditing, setProxyEditing] = useState(false);
  const [proxyDraft, setProxyDraft] = useState('');

  // Update
  const [autoUpdate, setAutoUpdate] = useState<boolean>(adv.autoUpdate ?? true);

  // Process isolation
  const [processIsolation, setProcessIsolation] = useState<boolean>(adv.processIsolation ?? true);

  // Context window
  const [maxContextTokens, setMaxContextTokens] = useState<string>(String(config?.maxContextTokens ?? 128000));
  const [ctxDirty, setCtxDirty] = useState(false);

  // Conversation dir
  const [convDir, setConvDir] = useState<string>(config?.conversationDir || '');
  const [convDirEditing, setConvDirEditing] = useState(false);
  const [convDirDraft, setConvDirDraft] = useState('');

  // System prompt
  const [systemPrompt, setSystemPrompt] = useState(config?.systemPrompt || '');
  const [spDirty, setSpDirty] = useState(false);

  // Reset
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setVersion);
    window.electronAPI.app.platform().then(setPlatform);
  }, []);

  useEffect(() => {
    setSystemPrompt(config?.systemPrompt || '');
    setSpDirty(false);
    setMaxContextTokens(String(config?.maxContextTokens ?? 128000));
    setCtxDirty(false);
    setConvDir(config?.conversationDir || '');
    const a = config?.advanced || {};
    setProxy(a.proxy ?? '');
    setAutoUpdate(a.autoUpdate ?? true);
    setProcessIsolation(a.processIsolation ?? true);
  }, [config]);

  // Handlers
  const handleSaveProxy = () => {
    const val = proxyDraft.trim();
    setProxy(val);
    saveKey('advanced.proxy', val);
    setProxyEditing(false);
  };

  const handleAutoUpdate = (v: boolean) => {
    setAutoUpdate(v);
    saveKey('advanced.autoUpdate', v);
  };

  const handleProcessIsolation = (v: boolean) => {
    setProcessIsolation(v);
    saveKey('advanced.processIsolation', v);
  };

  const handleSaveContextTokens = () => {
    const n = parseInt(maxContextTokens, 10);
    if (!isNaN(n) && n > 0) {
      saveKey('maxContextTokens', n);
      setCtxDirty(false);
    }
  };

  const handleSaveConvDir = () => {
    const val = convDirDraft.trim();
    setConvDir(val);
    saveKey('conversationDir', val || undefined);
    setConvDirEditing(false);
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    try {
      await window.electronAPI.config.reset();
      showStatus('配置已重置为默认值');
      onConfigReset();
    } catch (err: any) {
      showStatus(`重置失败: ${err.message}`);
    }
    setConfirmReset(false);
  };

  return (
    <div className="space-y-8">
      {/* --- 网络代理 --- */}
      <div>
        <SectionHeader title="网络代理" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">代理配置</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              代理配置同步自编辑器的 http.proxy 设置
            </p>
          </div>

          {/* Proxy address display */}
          <div className="bg-white/[0.02] border border-cp-border/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-cp-text-dim">代理地址：</span>
                <span className={`text-xs ml-1 ${proxy ? 'text-cp-text font-mono' : 'text-cp-text-dim/40'}`}>
                  {proxy || '未设置'}
                </span>
              </div>
              {!proxyEditing && (
                <button
                  onClick={() => { setProxyDraft(proxy); setProxyEditing(true); }}
                  className="text-[10px] text-cp-accent hover:text-cp-accent/80"
                >
                  编辑
                </button>
              )}
            </div>

            {proxyEditing && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={proxyDraft}
                  onChange={(e) => setProxyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveProxy();
                    if (e.key === 'Escape') setProxyEditing(false);
                  }}
                  placeholder="http://127.0.0.1:7890"
                  className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setProxyEditing(false)}
                    className="text-[10px] text-cp-text-dim hover:text-cp-text"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveProxy}
                    className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* --- 外观 --- */}
      <div>
        <SectionHeader title="外观" />
        <Card>
          <div className="space-y-3">
            <SettingRow 
              title="主题模式" 
              description={theme === 'dark' ? '当前：夜晚模式（深色背景，白色文字）' : '当前：白天模式（浅色背景，深色文字）'}
            >
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:text-cp-text hover:bg-white/10 transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <span className="text-lg">☀️</span>
                    <span className="text-xs">切换到白天</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">🌙</span>
                    <span className="text-xs">切换到夜晚</span>
                  </>
                )}
              </button>
            </SettingRow>
          </div>
        </Card>
      </div>

      {/* --- 更新 --- */}
      <div>
        <SectionHeader title="更新" />
        <Card>
          <div className="space-y-3">
            <SettingRow title="自动更新" description="检测到新版本时自动下载，下次启动时安装">
              <Toggle checked={autoUpdate} onChange={handleAutoUpdate} />
            </SettingRow>

            <Divider />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cp-text">当前版本</p>
                <p className="text-[11px] text-cp-text-dim/50 mt-0.5 font-mono">{version || '...'}</p>
              </div>
              <div className="flex items-center gap-2">
                <UpdateStatusBadge state={update} />
                <button
                  onClick={() => { update.checkForUpdates(); window.electronAPI?.update?.setAutoDownload(autoUpdate); }}
                  disabled={update.phase === 'checking' || update.phase === 'downloading'}
                  className="text-xs px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:text-cp-text hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  {update.phase === 'checking' ? '检查中...' : '检查更新'}
                </button>
              </div>
            </div>

            {update.phase === 'available' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm text-blue-300 font-medium">发现新版本 v{update.info?.version}</p>
                {update.info?.releaseNotes && (
                  <p className="text-[11px] text-blue-200/60 mt-1 whitespace-pre-wrap">{update.info?.releaseNotes}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={update.downloadUpdate} className="text-xs px-3 py-1.5 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors">
                    立即下载
                  </button>
                </div>
              </div>
            )}

            {update.phase === 'downloading' && (
              <div className="bg-cp-bg/50 border border-cp-border/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-cp-text-dim">正在下载更新...</p>
                  <p className="text-xs text-cp-text-dim font-mono">{update.progress?.percent}%</p>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-cp-accent transition-all duration-300" style={{ width: `${update.progress?.percent}%` }} />
                </div>
              </div>
            )}

            {update.phase === 'downloaded' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-sm text-green-300 font-medium">更新已下载完成</p>
                <button onClick={update.installUpdate} className="text-xs px-3 py-1.5 rounded-md bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors mt-2">
                  立即重启安装
                </button>
              </div>
            )}

            {update.phase === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-300">更新检查失败</p>
                <p className="text-[11px] text-red-200/60 mt-1 font-mono">{update.error}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* --- 扩展进程隔离 --- */}
      <div>
        <SectionHeader title="扩展进程隔离" />
        <Card>
          <SettingRow
            title="AI 扩展独立进程运行"
            description="将 AI 编码扩展运行在独立的扩展宿主进程中，与第三方扩展隔离以提升稳定性。关闭后可减少内存占用。修改后需要重新加载窗口才能生效。"
          >
            <Toggle checked={processIsolation} onChange={handleProcessIsolation} />
          </SettingRow>
        </Card>
      </div>

      {/* --- 上下文窗口 --- */}
      <div>
        <SectionHeader title="上下文窗口" />
        <Card>
          <SettingRow
            title="最大 Token"
            description="对话历史超过此长度时会自动裁剪。较大的窗口消耗更多 Token。"
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={maxContextTokens}
                onChange={(e) => { setMaxContextTokens(e.target.value); setCtxDirty(true); }}
                className="w-[100px] bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text text-center outline-none focus:border-cp-accent"
                placeholder="128000"
              />
              {ctxDirty && (
                <button
                  onClick={handleSaveContextTokens}
                  className="text-xs px-2 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                >
                  保存
                </button>
              )}
            </div>
          </SettingRow>
        </Card>
      </div>

      {/* --- 对话存储 --- */}
      <div>
        <SectionHeader title="对话存储" />
        <Card>
          <div className="flex items-center justify-between py-2.5">
            <div className="min-w-0 mr-4">
              <p className="text-sm text-cp-text">存储路径</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5">自定义对话记录存储位置</p>
            </div>
            {!convDirEditing && (
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-mono ${convDir ? 'text-cp-text' : 'text-cp-text-dim/40'}`}>
                  {convDir || '默认: ~/.lingjing/conversations/'}
                </span>
                <button
                  onClick={() => { setConvDirDraft(convDir); setConvDirEditing(true); }}
                  className="text-[10px] text-cp-accent hover:text-cp-accent/80"
                >
                  编辑
                </button>
              </div>
            )}
          </div>
          {convDirEditing && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={convDirDraft}
                onChange={(e) => setConvDirDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveConvDir();
                  if (e.key === 'Escape') setConvDirEditing(false);
                }}
                placeholder="~/.lingjing/conversations/"
                className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                autoFocus
              />
              <button
                onClick={() => setConvDirEditing(false)}
                className="text-[10px] text-cp-text-dim hover:text-cp-text shrink-0"
              >
                取消
              </button>
              <button
                onClick={handleSaveConvDir}
                className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors shrink-0"
              >
                保存
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* --- 系统提示词覆盖 --- */}
      <div>
        <SectionHeader title="系统提示词覆盖" />
        <Card>
          <p className="text-[11px] text-cp-text-dim/50 mb-3 leading-relaxed">
            完全替换默认系统提示词。留空则使用内置提示词。如果只想追加规则，请使用「规则」页签。
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => { setSystemPrompt(e.target.value); setSpDirty(true); }}
            rows={6}
            className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text
              outline-none focus:border-cp-accent font-mono resize-y min-h-[80px] leading-relaxed
              placeholder:text-cp-text-dim/40"
            placeholder="留空使用默认提示词..."
          />
          {spDirty && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => { saveKey('systemPrompt', systemPrompt || undefined); setSpDirty(false); }}
                className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
              >
                保存
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* --- 重置 --- */}
      <div>
        <SectionHeader title="重置" />
        <Card className="!border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cp-text">重置所有设置</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5">
                清除所有配置（包括 API Key），恢复为默认值
              </p>
            </div>
            <button
              onClick={handleReset}
              className={`shrink-0 ml-4 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                confirmReset
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
              }`}
            >
              {confirmReset ? '确认重置？' : '重置配置'}
            </button>
          </div>
        </Card>
      </div>

      {/* --- 调试信息 --- */}
      <div>
        <SectionHeader title="调试信息" />
        <Card>
          <div className="text-xs text-cp-text-dim/60 space-y-1.5 font-mono">
            <p>版本: {version || '...'}</p>
            <p>平台: {platform || '...'}</p>
            <p>配置文件: ~/.lingjing/config.json</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
