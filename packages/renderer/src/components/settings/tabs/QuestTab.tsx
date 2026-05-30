import { useState } from 'react';

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

/* --- Types --- */

interface QuestTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

/* --- Main Component --- */

export function QuestTab({ config, saveKey }: QuestTabProps) {
  const q = config?.quest || {};
  const gh = q.github || {};
  const remote = q.remote || {};

  // Worktree script
  const [worktreeScript, setWorktreeScript] = useState<string>(q.worktreeScript ?? '');
  const [worktreeDirty, setWorktreeDirty] = useState(false);

  // GitHub
  const [ghRepo, setGhRepo] = useState<string>(gh.repo ?? '');
  const [ghToken, setGhToken] = useState<string>(gh.token ?? '');
  const [ghConnected, setGhConnected] = useState<boolean>(gh.connected ?? false);
  const [editingGh, setEditingGh] = useState(false);

  // Remote
  const [dockerfile, setDockerfile] = useState<string>(remote.dockerfile ?? '');
  const [installScript, setInstallScript] = useState<string>(remote.installScript ?? '');
  const [installDirty, setInstallDirty] = useState(false);
  const [dockerDirty, setDockerDirty] = useState(false);

  // File change behavior
  const [fileChangeBehavior, setFileChangeBehavior] = useState<string>(q.fileChangeBehavior ?? 'ask');
  const [fcbDirty, setFcbDirty] = useState(false);

  const handleSaveWorktreeScript = () => {
    saveKey('quest.worktreeScript', worktreeScript);
    setWorktreeDirty(false);
  };

  const handleSaveGitHub = async () => {
    const hasToken = ghToken.trim().length > 0;
    await saveKey('quest.github.repo', ghRepo);
    await saveKey('quest.github.token', ghToken);
    await saveKey('quest.github.connected', hasToken);
    setGhConnected(hasToken);
    setEditingGh(false);
  };

  const handleRefreshGh = async () => {
    // Fetch fresh data from backend
    try {
      const freshConfig = await window.electronAPI.config.get();
      const freshGh = freshConfig?.quest?.github || {};
      setGhRepo(freshGh.repo ?? '');
      setGhToken(freshGh.token ?? '');
      setGhConnected(freshGh.connected ?? false);
    } catch {
      // Fallback to current config prop
      const freshGh = config?.quest?.github || {};
      setGhRepo(freshGh.repo ?? '');
      setGhToken(freshGh.token ?? '');
      setGhConnected(freshGh.connected ?? false);
    }
  };

  const handleSaveDockerfile = () => {
    saveKey('quest.remote.dockerfile', dockerfile);
    setDockerDirty(false);
  };

  const handleSaveInstallScript = () => {
    saveKey('quest.remote.installScript', installScript);
    setInstallDirty(false);
  };

  const handleSaveFileChangeBehavior = async () => {
    await saveKey('quest.fileChangeBehavior', fileChangeBehavior);
    setFcbDirty(false);
    window.dispatchEvent(new CustomEvent('quest:file-behavior-changed', {
      detail: { behavior: fileChangeBehavior },
    }));
  };

  return (
    <div className="space-y-8">
      {/* --- 本地任务: Worktree 配置 --- */}
      <div>
        <SectionHeader title="Worktree 配置" badge="本地任务" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">Worktree 的启动配置</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              建议配置一个启动脚本，用于在创建 worktree 时初始化目录。
            </p>
          </div>
          <div className="relative">
            <textarea
              value={worktreeScript}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setWorktreeScript(e.target.value);
                  setWorktreeDirty(true);
                }
              }}
              placeholder={"# npm install\n# Copy-Item $env:ROOT_WORKTREE_PATH\\.env .env"}
              rows={5}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-cp-text-dim/40">{worktreeScript.length}/500</span>
              {worktreeDirty && (
                <button
                  onClick={handleSaveWorktreeScript}
                  className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                >
                  保存
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* --- 远程 Git --- */}
      <div>
        <SectionHeader title="远程 Git" />
        <Card>
          {/* GitHub Section */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-cp-text" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="text-sm text-cp-text font-medium">GitHub</span>
            </div>
            <p className="text-[11px] text-cp-text-dim/50 mb-3 leading-relaxed">
              连接一个 GitHub 仓库，以便在远程任务时创建提交请求。在每个远程任务开始时，Quest 模式会从 GitHub 克隆你的仓库。
            </p>

            {/* Status row */}
            <div className="bg-white/[0.02] border border-cp-border/30 rounded-lg p-3 space-y-2.5">
              {/* Authorization status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cp-text-dim">GitHub 授权</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] ${ghConnected ? 'text-green-400' : 'text-cp-text-dim/40'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ghConnected ? 'bg-green-500' : 'bg-cp-text-dim/30'}`} />
                    {ghConnected ? '访问获准' : '未连接'}
                  </span>
                  <button
                    onClick={handleRefreshGh}
                    className="text-[10px] text-cp-accent hover:text-cp-accent/80"
                  >
                    刷新
                  </button>
                </div>
              </div>

              {/* Repo name */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-cp-text-dim">仓库名</span>
                <span className="text-xs text-cp-text font-mono">{ghRepo || '(未配置)'}</span>
              </div>

              {/* Auth status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-cp-text-dim">授权状态</span>
                <span className={`text-xs ${ghConnected ? 'text-green-400' : 'text-amber-400'}`}>
                  {ghConnected ? '已授权' : '未授权'}
                </span>
              </div>
            </div>

            {/* Edit button */}
            <div className="mt-3">
              {!editingGh ? (
                <button
                  onClick={() => setEditingGh(true)}
                  className="text-xs px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:bg-white/10 hover:text-cp-text transition-colors"
                >
                  修改配置
                </button>
              ) : (
                <div className="space-y-2.5 bg-white/[0.02] border border-cp-border/30 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-cp-text-dim w-[70px] shrink-0">仓库名</label>
                    <input
                      type="text"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      placeholder="owner/repo"
                      className="flex-1 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-cp-text-dim w-[70px] shrink-0">Token</label>
                    <input
                      type="password"
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="flex-1 bg-cp-bg border border-cp-border/50 rounded px-2 py-1 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setEditingGh(false)}
                      className="text-[10px] text-cp-text-dim hover:text-cp-text"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveGitHub}
                      className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* --- 远程任务配置: 基础环境 --- */}
      <div>
        <SectionHeader title="远程任务配置" badge="当前仓库" />
        <Card>
          <div className="mb-4">
            <p className="text-sm text-cp-text font-medium">基础环境</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              通过 Dockerfile 为当前代码仓库配置执行环境。实际执行时，系统将以远程代码仓库中的最新版本文件为准。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={dockerfile}
              onChange={(e) => { setDockerfile(e.target.value); setDockerDirty(true); }}
              placeholder="Specify the Dockerfile path or select one"
              className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
            />
            {dockerDirty ? (
              <button
                onClick={handleSaveDockerfile}
                className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
              >
                保存
              </button>
            ) : (
              <button
                onClick={handleSaveDockerfile}
                className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:bg-white/10 hover:text-cp-text transition-colors"
              >
                验证
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* --- 运行时配置 --- */}
      <div>
        <SectionHeader title="运行时配置" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">安装脚本</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              在当前仓库执行远程任务时，系统都会检出相关的代码并运行安装脚本。
            </p>
          </div>
          <div className="relative">
            <textarea
              value={installScript}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setInstallScript(e.target.value);
                  setInstallDirty(true);
                }
              }}
              placeholder="例: apt-get install -y procps"
              rows={4}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text font-mono outline-none focus:border-cp-accent resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-cp-text-dim/40">{installScript.length}/500</span>
              {installDirty && (
                <button
                  onClick={handleSaveInstallScript}
                  className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                >
                  保存
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* --- 文件变更处理 --- */}
      <div>
        <SectionHeader title="文件变更处理" badge="Quest" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">文件变更自动处理</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              当 Quest 模式 AI 代理创建或编辑文件时，选择如何处理待审查的文件变更。
            </p>
          </div>
          <div className="space-y-2.5">
            {[
              { value: 'ask', label: '每次询问', desc: '新文件变更出现时在对话上方显示，手动决定接受或驳回' },
              { value: 'auto-accept', label: '自动全部接受', desc: '新文件变更出现时自动全部接受，无需人工确认' },
              { value: 'auto-reject', label: '自动全部驳回', desc: '新文件变更出现时自动全部驳回，仅查看效果不做保存' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  fileChangeBehavior === opt.value
                    ? 'border-cp-accent/50 bg-cp-accent/5'
                    : 'border-cp-border/30 hover:bg-white/[0.03]'
                }`}
                onClick={() => {
                  if (fileChangeBehavior !== opt.value) {
                    setFileChangeBehavior(opt.value);
                    setFcbDirty(true);
                  }
                }}
              >
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  fileChangeBehavior === opt.value
                    ? 'border-cp-accent'
                    : 'border-cp-border'
                }`}>
                  {fileChangeBehavior === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-cp-accent" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-cp-text font-medium">{opt.label}</p>
                  <p className="text-[11px] text-cp-text-dim/50 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          {fcbDirty && (
            <div className="flex justify-end mt-3">
              <button
                onClick={handleSaveFileChangeBehavior}
                className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
              >
                保存配置
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
