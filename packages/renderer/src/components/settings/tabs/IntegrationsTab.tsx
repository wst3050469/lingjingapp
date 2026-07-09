import { useState, useEffect } from 'react';

/* --- Helper components --- */

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-xs font-medium text-cp-text-dim/70 uppercase tracking-wider">{title}</h4>
      {badge && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cp-accent/15 text-cp-accent">{badge}</span>
      )}
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
        {description && <p className="text-[11px] text-cp-text-dim/50 mt-0.5">{description}</p>}
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

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent cursor-pointer appearance-none pr-8"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function Divider() {
  return <div className="border-t border-cp-border/15" />;
}

/* --- Types --- */

interface IntegrationsTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

/* --- Main Component --- */

export function IntegrationsTab({ config, saveKey }: IntegrationsTabProps) {
  const integ = config?.integrations || {};
  const ba = integ.browserAgent || {};
  const pa = integ.planAgent || {};
  const gh = integ.github || {};
  const sb = integ.supabase || {};

  // Built-in agent states
  const [browserType, setBrowserType] = useState<string>(ba.browserType ?? 'builtin');
  const [browserPolicy, setBrowserPolicy] = useState<string>(ba.executionPolicy ?? 'ask');
  const [browserToolsAuto, setBrowserToolsAuto] = useState<boolean>(ba.toolsAutoExecute ?? true);
  const [planPolicy, setPlanPolicy] = useState<string>(pa.executionPolicy ?? 'ask');
  const [builtinBrowser, setBuiltinBrowser] = useState<boolean>(integ.builtinBrowser ?? true);

  // GitHub states
  const [ghConnected, setGhConnected] = useState<boolean>(gh.connected ?? false);
  const [ghUsername, setGhUsername] = useState<string>(gh.username ?? '');
  const [ghEditing, setGhEditing] = useState(false);
  const [ghToken, setGhToken] = useState('');
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState('');

  // FRP / Web Server states
  const [frpEnabled, setFrpEnabled] = useState(false);
  const [frpServerAddr, setFrpServerAddr] = useState('www.spiritrealmz.com');
  const [frpServerPort, setFrpServerPort] = useState('32200');
  const [frpRemotePort, setFrpRemotePort] = useState('8080');
  const [frpToken, setFrpToken] = useState('lingjing_mobile_token_2024');
  const [frpCustomDomain, setFrpCustomDomain] = useState('www.spiritrealmz.com');
  const [frpStatus, setFrpStatus] = useState<string>('检查中...');
  const [webServerStatus, setWebServerStatus] = useState<string>('检查中...');
  const [frpLoaded, setFrpLoaded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [frpSaving, setFrpSaving] = useState(false);

  // Periodic status polling
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const s = await window.electronAPI.webServer.getStatus();
        setWebServerStatus(s?.webServerRunning ? '运行中' : '已停止');
        if (frpEnabled) {
          setFrpStatus(s?.frp?.running ? '运行中' : '未连接');
        } else {
          setFrpStatus('已关闭');
        }
      } catch {
        setFrpStatus(frpEnabled ? '未连接' : '已关闭');
        setWebServerStatus('未知');
      }
    };

    // Check immediately
    pollStatus();

    // Poll every 3 seconds
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [frpEnabled]);

  // Load GitHub saved token on mount (safety net for schema stripping)
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await window.electronAPI.integrations.githubGetSavedToken();
        if (saved && saved.connected) {
          setGhConnected(true);
          setGhUsername(saved.username || '');
        }
      } catch { /* ignore - main flow uses config prop */ }
    };
    load();
  }, []);

  // Load FRP config on mount
  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await window.electronAPI.webServer.getConfig();
        if (cfg) {
          setFrpEnabled(cfg.frpEnabled ?? false);
          setFrpServerAddr(cfg.frpServerAddr || 'www.spiritrealmz.com');
          setFrpServerPort(String(cfg.frpServerPort || 32200));
          setFrpRemotePort(String(cfg.frpRemotePort || 8080));
          setFrpToken(cfg.frpToken || 'lingjing_mobile_token_2024');
          setFrpCustomDomain(cfg.frpCustomDomain || 'www.spiritrealmz.com');
        }
      } catch {} finally { setFrpLoaded(true); }
    };
    load();
  }, []);

  // Supabase states
  const [sbConnected, setSbConnected] = useState<boolean>(sb.connected ?? false);
  const [sbProjectUrl, setSbProjectUrl] = useState<string>(sb.projectUrl ?? '');
  const [sbEditing, setSbEditing] = useState(false);
  const [sbUrlDraft, setSbUrlDraft] = useState('');
  const [sbKeyDraft, setSbKeyDraft] = useState('');
  const [sbLoading, setSbLoading] = useState(false);
  const [sbError, setSbError] = useState('');

  // --- Built-in agent handlers ---
  const handleBrowserType = (v: string) => {
    setBrowserType(v);
    saveKey('integrations.browserAgent.browserType', v);
  };

  const handleBrowserPolicy = (v: string) => {
    setBrowserPolicy(v);
    saveKey('integrations.browserAgent.executionPolicy', v);
  };

  const handleBrowserToolsAuto = (v: boolean) => {
    setBrowserToolsAuto(v);
    saveKey('integrations.browserAgent.toolsAutoExecute', v);
  };

  const handlePlanPolicy = (v: string) => {
    setPlanPolicy(v);
    saveKey('integrations.planAgent.executionPolicy', v);
  };

  const handleBuiltinBrowser = (v: boolean) => {
    setBuiltinBrowser(v);
    saveKey('integrations.builtinBrowser', v);
  };

  // --- FRP handlers ---
  const handleFrpToggle = async (v: boolean) => {
    setFrpEnabled(v);
    setFrpSaving(true);
    // BUGFIX: enabled must be true always — FRP toggle should NOT disable Web Server
    const cfg = {
      enabled: true,
      port: 3001,
      token: '',
      frpEnabled: v,
      frpServerAddr,
      frpServerPort: parseInt(frpServerPort) || 32200,
      frpRemotePort: parseInt(frpRemotePort) || 8080,
      frpToken,
      frpCustomDomain,
    };
    try {
      await window.electronAPI.webServer.saveConfig(cfg);
      if (v) {
        setFrpStatus('连接中...');
      } else {
        setFrpStatus('已关闭');
      }
    } catch {
      setFrpEnabled(!v);
    } finally {
      setFrpSaving(false);
    }
  };

  const handleFrpSave = async () => {
    setFrpSaving(true);
    try {
      await window.electronAPI.webServer.saveConfig({
        enabled: true,
        port: 3001,
        token: '',
        frpEnabled,
        frpServerAddr,
        frpServerPort: parseInt(frpServerPort) || 32200,
        frpRemotePort: parseInt(frpRemotePort) || 8080,
        frpToken,
        frpCustomDomain,
      });
    } catch {} finally {
      setFrpSaving(false);
    }
  };

  // --- GitHub handlers ---
  const handleGhConnect = async () => {
    if (!ghToken.trim()) {
      setGhError('请输入 GitHub Token');
      return;
    }
    setGhLoading(true);
    setGhError('');
    try {
      const res = await window.electronAPI.integrations.githubConnect(ghToken.trim());
      if (res.success) {
        setGhConnected(true);
        setGhUsername(res.username || '');
        setGhEditing(false);
        setGhToken('');
      } else {
        setGhError(res.error || '连接失败');
      }
    } catch (err: any) {
      setGhError(err.message || '连接失败');
    } finally {
      setGhLoading(false);
    }
  };

  const handleGhDisconnect = async () => {
    try {
      await window.electronAPI.integrations.githubDisconnect();
      setGhConnected(false);
      setGhUsername('');
    } catch {
      // ignore
    }
  };

  // --- Supabase handlers ---
  const handleSbConnect = async () => {
    if (!sbUrlDraft.trim() || !sbKeyDraft.trim()) {
      setSbError('请填写项目 URL 和 Anon Key');
      return;
    }
    setSbLoading(true);
    setSbError('');
    try {
      const res = await window.electronAPI.integrations.supabaseConnect(sbUrlDraft.trim(), sbKeyDraft.trim());
      if (res.success) {
        setSbConnected(true);
        setSbProjectUrl(sbUrlDraft.trim());
        setSbEditing(false);
        setSbUrlDraft('');
        setSbKeyDraft('');
      } else {
        setSbError(res.error || '连接失败');
      }
    } catch (err: any) {
      setSbError(err.message || '连接失败');
    } finally {
      setSbLoading(false);
    }
  };

  const handleSbDisconnect = async () => {
    try {
      await window.electronAPI.integrations.supabaseDisconnect();
      setSbConnected(false);
      setSbProjectUrl('');
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      {/* --- Description --- */}
      <p className="text-[13px] text-cp-text-dim/60 -mt-2">
        配置和管理第三方服务或内置智能体的集成
      </p>

      {/* --- Built-in Agents --- */}
      <div>
        <SectionHeader title="内置智能体" />
        <Card>
          {/* Browser Type */}
          <SettingRow
            title="浏览器类型"
            description="选择 Browser Agent 使用的浏览器"
          >
            <Select
              value={browserType}
              onChange={handleBrowserType}
              options={[
                { value: 'builtin', label: '内置浏览器' },
                { value: 'chrome', label: 'Google Chrome' },
                { value: 'firefox', label: 'Firefox' },
                { value: 'edge', label: 'Microsoft Edge' },
              ]}
            />
          </SettingRow>

          <Divider />

          {/* Browser Agent Policy */}
          <SettingRow
            title="浏览器智能体"
            description="配置浏览器智能体的执行策略。轻量模型分级不支持此功能"
          >
            <Select
              value={browserPolicy}
              onChange={handleBrowserPolicy}
              options={[
                { value: 'ask', label: '每次询问' },
                { value: 'auto', label: '自动运行' },
              ]}
            />
          </SettingRow>

          <Divider />

          {/* Browser Agent Tools */}
          <SettingRow
            title="浏览器智能体工具"
            description="允许浏览器智能体自动执行工具"
          >
            <Toggle checked={browserToolsAuto} onChange={handleBrowserToolsAuto} />
          </SettingRow>

          <Divider />

          {/* Plan Agent Policy */}
          <SettingRow
            title="计划智能体"
            description="配置计划智能体的执行策略"
          >
            <Select
              value={planPolicy}
              onChange={handlePlanPolicy}
              options={[
                { value: 'ask', label: '每次询问' },
                { value: 'auto', label: '自动运行' },
              ]}
            />
          </SettingRow>

          <Divider />

          {/* Built-in Browser */}
          <SettingRow
            title="内置浏览器"
            description="启用内置浏览器供智能体使用"
          >
            <Toggle checked={builtinBrowser} onChange={handleBuiltinBrowser} />
          </SettingRow>
        </Card>
      </div>

      {/* --- Third-party Services --- */}
      <div>
        <SectionHeader title="第三方服务" />

        {/* GitHub */}
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            {/* GitHub icon */}
            <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-cp-text" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cp-text font-medium">GitHub</p>
                  <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                    关联 GitHub，允许 Quest 模式等功能访问你的代码仓库。
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] ${ghConnected ? 'text-green-400' : 'text-cp-text-dim/40'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ghConnected ? 'bg-green-500' : 'bg-cp-text-dim/30'}`} />
                    {ghConnected ? '已连接' : '未连接'}
                  </span>
                </div>
              </div>

              {/* Connected state */}
              {ghConnected && !ghEditing && (
                <div className="mt-3 bg-white/[0.02] border border-cp-border/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cp-text-dim">账号</span>
                      <span className="text-xs text-cp-text font-mono">{ghUsername}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setGhEditing(true); setGhToken(''); setGhError(''); }}
                        className="text-[10px] text-cp-accent hover:text-cp-accent/80"
                      >
                        管理
                      </button>
                      <button
                        onClick={handleGhDisconnect}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        断开
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Not connected or editing */}
              {(!ghConnected || ghEditing) && (
                <div className="mt-3 space-y-2.5">
                  {!ghEditing && !ghConnected && (
                    <div className="space-y-2">
                      <button
                        onClick={() => { setGhEditing(true); setGhError(''); }}
                        className="text-xs px-3 py-1.5 rounded-md bg-cp-accent/20 border border-cp-accent/30 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                      >
                        授权
                      </button>
                      <a
                        href="https://github.com/settings/tokens/new?description=LingJing-IDE&scopes=repo,read:org,workflow"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-cp-text-dim/50 hover:text-cp-accent transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        前往 GitHub 创建 Personal Access Token
                      </a>
                    </div>
                  )}
                  {ghEditing && (
                    <div className="bg-white/[0.02] border border-cp-border/30 rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-cp-text-dim w-[80px] shrink-0">Personal Token</label>
                        <input
                          type="password"
                          value={ghToken}
                          onChange={(e) => setGhToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxx"
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGhConnect(); }}
                        />
                      </div>
                      {ghError && (
                        <p className="text-[11px] text-red-400">{ghError}</p>
                      )}
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setGhEditing(false)}
                          className="text-[10px] text-cp-text-dim hover:text-cp-text"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleGhConnect}
                          disabled={ghLoading}
                          className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors disabled:opacity-50"
                        >
                          {ghLoading ? '验证中...' : '连接'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Supabase */}
        <Card>
          <div className="flex items-start gap-3">
            {/* Supabase icon */}
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 109 113" fill="currentColor">
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fillOpacity="0.6" />
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" />
                <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cp-text font-medium">Supabase</p>
                  <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                    连接 Supabase 账户，管理数据库和后端服务。
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] ${sbConnected ? 'text-green-400' : 'text-cp-text-dim/40'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sbConnected ? 'bg-green-500' : 'bg-cp-text-dim/30'}`} />
                    {sbConnected ? '已连接' : '未连接'}
                  </span>
                </div>
              </div>

              {/* Connected state */}
              {sbConnected && !sbEditing && (
                <div className="mt-3 bg-white/[0.02] border border-cp-border/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-cp-text-dim shrink-0">项目</span>
                      <span className="text-xs text-cp-text font-mono truncate">{sbProjectUrl}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <button
                        onClick={() => { setSbEditing(true); setSbUrlDraft(sbProjectUrl); setSbKeyDraft(''); setSbError(''); }}
                        className="text-[10px] text-cp-accent hover:text-cp-accent/80"
                      >
                        管理
                      </button>
                      <button
                        onClick={handleSbDisconnect}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        断开
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Not connected or editing */}
              {(!sbConnected || sbEditing) && (
                <div className="mt-3 space-y-2.5">
                  {!sbEditing && !sbConnected && (
                    <button
                      onClick={() => { setSbEditing(true); setSbError(''); }}
                      className="text-xs px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:bg-white/10 hover:text-cp-text transition-colors"
                    >
                      管理
                    </button>
                  )}
                  {sbEditing && (
                    <div className="bg-white/[0.02] border border-cp-border/30 rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-cp-text-dim w-[80px] shrink-0">项目 URL</label>
                        <input
                          type="text"
                          value={sbUrlDraft}
                          onChange={(e) => setSbUrlDraft(e.target.value)}
                          placeholder="https://xxxxx.supabase.co"
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-cp-text-dim w-[80px] shrink-0">Anon Key</label>
                        <input
                          type="password"
                          value={sbKeyDraft}
                          onChange={(e) => setSbKeyDraft(e.target.value)}
                          placeholder="eyJhbGciOiJIUzI1NiIs..."
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSbConnect(); }}
                        />
                      </div>
                      {sbError && (
                        <p className="text-[11px] text-red-400">{sbError}</p>
                      )}
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setSbEditing(false)}
                          className="text-[10px] text-cp-text-dim hover:text-cp-text"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSbConnect}
                          disabled={sbLoading}
                          className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors disabled:opacity-50"
                        >
                          {sbLoading ? '验证中...' : '连接'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* 灵境AI移动端 - 极简设计 */}
        <Card className="mt-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cp-text font-medium">灵境AI移动端</p>
                  <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                    开启后在手机上访问灵境AI，随时管理任务和对话
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {frpLoaded && (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] ${
                      frpEnabled && frpStatus === '运行中' ? 'text-green-400' :
                      frpSaving ? 'text-blue-400' :
                      'text-cp-text-dim/40'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        frpEnabled && frpStatus === '运行中' ? 'bg-green-500 animate-pulse' :
                        frpSaving ? 'bg-blue-500 animate-pulse' :
                        'bg-cp-text-dim/30'}`} />
                      {frpSaving ? '配置中...' : frpEnabled ? (frpStatus === '运行中' ? '已连接' : '连接中...') : '未连接'}
                    </span>
                  )}
                  {frpLoaded && (
                    <Toggle checked={frpEnabled} onChange={handleFrpToggle} />
                  )}
                </div>
              </div>

              {frpLoaded && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-[10px] text-cp-text-dim/60 hover:text-cp-accent transition-colors flex items-center gap-1"
                  >
                    <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    高级设置
                  </button>
                  {showAdvanced && (
                    <div className="mt-2 p-3 bg-white/[0.02] border border-cp-border/30 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-cp-text-dim w-[55px] shrink-0">地址</label>
                        <input type="text" value={frpServerAddr}
                          onChange={(e) => setFrpServerAddr(e.target.value)}
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-[11px] text-cp-text font-mono outline-none focus:border-cp-accent"
                          disabled={!frpEnabled} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-cp-text-dim w-[55px] shrink-0">端口</label>
                        <input type="text" value={frpServerPort}
                          onChange={(e) => setFrpServerPort(e.target.value)}
                          className="w-20 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-[11px] text-cp-text font-mono outline-none focus:border-cp-accent"
                          disabled={!frpEnabled} />
                        <label className="text-[10px] text-cp-text-dim shrink-0">远程</label>
                        <input type="text" value={frpRemotePort}
                          onChange={(e) => setFrpRemotePort(e.target.value)}
                          className="w-20 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-[11px] text-cp-text font-mono outline-none focus:border-cp-accent"
                          disabled={!frpEnabled} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-cp-text-dim w-[55px] shrink-0">Token</label>
                        <input type="text" value={frpToken}
                          onChange={(e) => setFrpToken(e.target.value)}
                          className="flex-1 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-[11px] text-cp-text font-mono outline-none focus:border-cp-accent"
                          disabled={!frpEnabled} />
                      </div>
                      <div className="flex justify-end">
                        <button onClick={handleFrpSave} disabled={frpSaving}
                          className="text-[10px] px-2 py-1 rounded bg-cp-accent/15 text-cp-accent hover:bg-cp-accent/25 transition-colors disabled:opacity-50">
                          {frpSaving ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {frpEnabled && frpStatus === '运行中' && (
                <div className="mt-2 flex items-center gap-2 text-[10px]">
                  <span className="text-cp-text-dim/40">手机访问</span>
                  <code className="px-1.5 py-0.5 bg-cp-accent/10 rounded text-cp-accent text-[10px] font-mono">
                    https://{frpCustomDomain || frpServerAddr}
                  </code>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
