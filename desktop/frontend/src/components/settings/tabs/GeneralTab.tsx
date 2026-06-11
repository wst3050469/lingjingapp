import { useState } from 'react';

/* ─── Helper components ─── */

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

function ActionRow({
  title,
  description,
  buttonLabel,
  onClick,
}: {
  title: string;
  description?: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-cp-border/15 last:border-b-0">
      <div className="min-w-0 mr-4">
        <p className="text-sm text-cp-text">{title}</p>
        {description && <p className="text-[11px] text-cp-text-dim/50 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={onClick}
        className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:bg-white/10 hover:text-cp-text transition-colors"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

/* ─── Types ─── */

interface GeneralTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
  user: { username?: string; email?: string | null } | null;
  logout: () => void;
  workspace: string;
  handleSelectFolder: () => void;
}

/* ─── Main Component ─── */

export function GeneralTab({ config, saveKey, user, logout, workspace, handleSelectFolder }: GeneralTabProps) {
  const language = config?.language || 'auto';

  // Notification toggles (persisted via config)
  const [notifyConversation, setNotifyConversation] = useState<boolean>(config?.notifications?.conversation ?? true);
  const [notifyQuest, setNotifyQuest] = useState<boolean>(config?.notifications?.quest ?? true);
  const [notifyRepoWiki, setNotifyRepoWiki] = useState<boolean>(config?.notifications?.repoWiki ?? true);

  const handleNotifyConversation = (v: boolean) => {
    setNotifyConversation(v);
    saveKey('notifications.conversation', v);
  };

  const handleNotifyQuest = (v: boolean) => {
    setNotifyQuest(v);
    saveKey('notifications.quest', v);
  };

  const handleNotifyRepoWiki = (v: boolean) => {
    setNotifyRepoWiki(v);
    saveKey('notifications.repoWiki', v);
  };

  // Shortcuts modal
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="space-y-8">
      {/* ── 订阅计划 ── */}
      <div>
        <SectionHeader title="订阅计划" />
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cp-accent/20 flex items-center justify-center text-base text-cp-accent font-semibold">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-cp-text font-medium">{user?.username || '未登录'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cp-accent/20 text-cp-accent">本地版</span>
                </div>
                {user?.email && <p className="text-[11px] text-cp-text-dim/50 mt-0.5">{user.email}</p>}
              </div>
            </div>
            <button
              onClick={logout}
              className="text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
            >
              退出登录
            </button>
          </div>
        </Card>
      </div>

      {/* ── 语言 ── */}
      <div>
        <SectionHeader title="语言" />
        <Card>
          <SettingRow title="AI 回复语言" description="设置 AI 回复内容的偏好语言">
            <select
              value={language}
              onChange={(e) => saveKey('language', e.target.value)}
              className="bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent cursor-pointer min-w-[130px]"
            >
              <option value="auto">自动检测</option>
              <option value="zh">简体中文</option>
              <option value="en">English</option>
            </select>
          </SettingRow>
        </Card>
      </div>

      {/* ── 通知 ── */}
      <div>
        <SectionHeader title="通知" />
        <Card>
          <SettingRow title="会话通知" description="在会话完成回复/需要您的操作时展示系统通知">
            <Toggle checked={notifyConversation} onChange={handleNotifyConversation} />
          </SettingRow>
          <div className="border-t border-cp-border/15" />
          <SettingRow title="Quest 模式通知" description="在 Quest Mode 中需要您的操作/完成任务时展示系统通知">
            <Toggle checked={notifyQuest} onChange={handleNotifyQuest} />
          </SettingRow>
          <div className="border-t border-cp-border/15" />
          <SettingRow title="Repo Wiki 通知" description="在 Repo Wiki 生成结束时展示系统通知">
            <Toggle checked={notifyRepoWiki} onChange={handleNotifyRepoWiki} />
          </SettingRow>
        </Card>
      </div>

      {/* ── 偏好 ── */}
      <div>
        <SectionHeader title="偏好" />
        <Card className="!p-0 overflow-hidden">
          <div className="px-4">
            <ActionRow
              title="键盘快捷键"
              description="查看和自定义键盘快捷键"
              buttonLabel="查看"
              onClick={() => setShowShortcuts(true)}
            />
            <ActionRow
              title="工作区设置"
              description={workspace || '未选择工作区'}
              buttonLabel="修改"
              onClick={handleSelectFolder}
            />
          </div>
        </Card>
      </div>

      {/* ── 隐私 ── */}
      <div>
        <SectionHeader title="隐私" />
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-cp-text font-medium">本地模式</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
                灵境运行在本地模式下。你的代码和对话数据仅存储在本地设备上，不会上传到任何外部服务器。
                AI 请求直接发送到你配置的模型提供商。
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Shortcuts Modal ── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowShortcuts(false)}>
          <div className="bg-cp-panel border border-cp-border rounded-xl w-[400px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-cp-border/30">
              <h3 className="text-sm text-cp-text font-medium">键盘快捷键</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-cp-text-dim hover:text-cp-text">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Ctrl+N', '新建对话'],
                    ['Ctrl+L', '清屏'],
                    ['Escape', '停止生成'],
                    ['Ctrl+,', '打开设置'],
                    ['Ctrl+B', '切换侧边栏'],
                  ].map(([key, desc]) => (
                    <tr key={key} className="border-b border-cp-border/15 last:border-b-0">
                      <td className="py-2.5 pr-4">
                        <kbd className="bg-white/[0.06] border border-cp-border/30 px-2 py-1 rounded text-[11px] font-mono text-cp-text-dim">
                          {key}
                        </kbd>
                      </td>
                      <td className="py-2.5 text-cp-text-dim">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
