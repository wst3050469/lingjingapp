import { useState } from 'react';
import { useChatStore } from '../../../stores/chat-store';

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

function Divider() {
  return <div className="border-t border-cp-border/15" />;
}

/* --- Types --- */

interface SessionTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
}

/* --- Main Component --- */

export function SessionTab({ config, saveKey }: SessionTabProps) {
  const s = config?.session || {};

  const [retrievalTools, setRetrievalTools] = useState<boolean>(s.retrievalTools ?? true);
  const [fileEditOutside, setFileEditOutside] = useState<boolean>(s.fileEditOutsideWorkspace ?? false);
  const [maxWindows, setMaxWindows] = useState<number>(s.maxWindows ?? 10);
  const [maxTurns, setMaxTurns] = useState<number>(config?.maxTurns ?? 50);
  const [autoExecute, setAutoExecute] = useState<boolean>(s.autoExecute ?? false);
  const [mcpTools, setMcpTools] = useState<boolean>(s.mcpTools ?? true);
  const [blockedCommands, setBlockedCommands] = useState<string>(s.blockedCommands ?? 'rm,mv,sudo,wget,curl,chown');
  const [webTools, setWebTools] = useState<boolean>(s.webTools ?? true);
  const [browserAgentTools, setBrowserAgentTools] = useState<boolean>(s.browserAgentTools ?? true);
  const [showCodeToolbar, setShowCodeToolbar] = useState<boolean>(s.showCodeSelectionToolbar ?? true);

  // Auto-compact settings (from chat store)
  const autoCompactEnabled = useChatStore((s) => s.autoCompactEnabled);
  const autoCompactThreshold = useChatStore((s) => s.autoCompactThreshold);
  const setAutoCompactEnabled = useChatStore((s) => s.setAutoCompactEnabled);
  const setAutoCompactThreshold = useChatStore((s) => s.setAutoCompactThreshold);

  const [editingCommands, setEditingCommands] = useState(false);
  const [commandsDraft, setCommandsDraft] = useState(blockedCommands);

  const toggle = (key: string, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v);
    saveKey(`session.${key}`, v);
  };

  const handleMaxWindowsChange = (val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 1 && n <= 50) {
      setMaxWindows(n);
      saveKey('session.maxWindows', n);
    }
  };

  const handleMaxTurnsChange = (val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 10 && n <= 500) {
      setMaxTurns(n);
      saveKey('maxTurns', n);
    }
  };

  const handleThresholdChange = (val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 10 && n <= 90) {
      setAutoCompactThreshold(n);
    }
  };

  const handleSaveCommands = () => {
    setBlockedCommands(commandsDraft);
    saveKey('session.blockedCommands', commandsDraft);
    setEditingCommands(false);
  };

  return (
    <div className="space-y-8">
      {/* --- 检索类工具 --- */}
      <div>
        <SectionHeader title="检索类工具" />
        <Card>
          <SettingRow
            title="检索类工具"
            description="在智能问答中启用本地文件与网络信息检索功能（网络信息检索需开启 Web 工具）"
          >
            <Toggle checked={retrievalTools} onChange={toggle('retrievalTools', setRetrievalTools)} />
          </SettingRow>
        </Card>
      </div>

      {/* --- 文件编辑工具 --- */}
      <div>
        <SectionHeader title="文件编辑工具" />
        <Card>
          <SettingRow
            title="文件编辑工具"
            description="允许文件编辑工具修改当前工作区外的文件。通过终端执行的文件修改不受此设置限制"
          >
            <Toggle checked={fileEditOutside} onChange={toggle('fileEditOutsideWorkspace', setFileEditOutside)} />
          </SettingRow>
        </Card>
      </div>

      {/* --- 会话窗口上限 --- */}
      <div>
        <SectionHeader title="会话窗口上限" />
        <Card>
          <SettingRow
            title="会话窗口上限"
            description="限制同时打开的会话窗口数量"
          >
            <input
              type="number"
              min={1}
              max={50}
              value={maxWindows}
              onChange={(e) => handleMaxWindowsChange(e.target.value)}
              className="w-[70px] bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text text-center outline-none focus:border-cp-accent"
            />
          </SettingRow>
        </Card>
      </div>

      {/* --- 智能体最大轮次 --- */}
      <div>
        <SectionHeader title="智能体最大轮次" />
        <Card>
          <SettingRow
            title="智能体最大轮次"
            description="单次任务中智能体可执行的最大轮次（Quest 模式最低 200 轮）"
          >
            <input
              type="number"
              min={10}
              max={500}
              value={maxTurns}
              onChange={(e) => handleMaxTurnsChange(e.target.value)}
              className="w-[70px] bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text text-center outline-none focus:border-cp-accent"
            />
          </SettingRow>
        </Card>
      </div>

      {/* --- 自动压缩对话 --- */}
      <div>
        <SectionHeader title="自动压缩对话" />
        <Card>
          <SettingRow
            title="自动压缩对话"
            description="当上下文 Token 使用量达到阈值时，自动调用 LLM 对历史对话进行摘要压缩，无需手动点击精简按钮"
          >
            <Toggle checked={autoCompactEnabled} onChange={setAutoCompactEnabled} />
          </SettingRow>
          {autoCompactEnabled && (
            <>
              <Divider />
              <SettingRow
                title="压缩阈值"
                description={`当前累计 Token 数超过上下文上限的 ${autoCompactThreshold}% 时自动触发压缩`}
              >
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={autoCompactThreshold}
                    onChange={(e) => handleThresholdChange(e.target.value)}
                    className="w-[60px] bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text text-center outline-none focus:border-cp-accent"
                  />
                  <span className="text-sm text-cp-text-dim">%</span>
                </div>
              </SettingRow>
            </>
          )}
        </Card>
      </div>

      {/* --- 自动执行 --- */}
      <div>
        <SectionHeader title="自动执行" />
        <Card>
          <SettingRow
            title="自动执行"
            description="专家团模式下，多智能体协同编码，全自动执行，无需人工确认"
          >
            <Toggle checked={autoExecute} onChange={toggle('autoExecute', setAutoExecute)} />
          </SettingRow>
          {autoExecute && (
            <div className="mt-1 flex items-start gap-2 px-1">
              <svg className="w-3.5 h-3.5 text-amber-400/70 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-[11px] text-amber-400/70 leading-relaxed">
                开启后，智能体将自动执行所有操作（包括文件修改和终端命令），请确保你了解风险。
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* --- MCP 工具 --- */}
      <div>
        <SectionHeader title="MCP 工具" />
        <Card>
          <SettingRow
            title="MCP 工具"
            description="允许智能体自动执行 MCP 工具"
          >
            <Toggle checked={mcpTools} onChange={toggle('mcpTools', setMcpTools)} />
          </SettingRow>
        </Card>
      </div>

      {/* --- 智能体模式的终端 --- */}
      <div>
        <SectionHeader title="智能体模式的终端" />
        <Card>
          <div className="py-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0 mr-4">
                <p className="text-sm text-cp-text">禁止自动执行的命令</p>
                <p className="text-[11px] text-cp-text-dim/50 mt-0.5">输入禁止自动执行的命令，多个命令请用英文逗号分隔</p>
              </div>
              {!editingCommands && (
                <button
                  onClick={() => { setCommandsDraft(blockedCommands); setEditingCommands(true); }}
                  className="shrink-0 text-[10px] text-cp-accent hover:text-cp-accent/80"
                >
                  编辑
                </button>
              )}
            </div>
            {editingCommands ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commandsDraft}
                  onChange={(e) => setCommandsDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCommands();
                    if (e.key === 'Escape') setEditingCommands(false);
                  }}
                  className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent font-mono"
                  placeholder="rm,mv,sudo,wget,curl,chown"
                  autoFocus
                />
                <button
                  onClick={handleSaveCommands}
                  className="text-[10px] text-cp-accent hover:text-cp-accent/80 shrink-0"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingCommands(false)}
                  className="text-[10px] text-cp-text-dim hover:text-cp-text shrink-0"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {blockedCommands.split(',').filter(Boolean).map((cmd) => (
                  <span
                    key={cmd.trim()}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 font-mono"
                  >
                    {cmd.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* --- Web 工具 --- */}
      <div>
        <SectionHeader title="Web 工具" />
        <Card>
          <SettingRow
            title="Web 工具"
            description="允许在智能问答/智能体模式下，通过网络搜索或从指定 URL 获取信息"
          >
            <Toggle checked={webTools} onChange={toggle('webTools', setWebTools)} />
          </SettingRow>
        </Card>
      </div>

      {/* --- 浏览器智能体工具 --- */}
      <div>
        <SectionHeader title="浏览器智能体工具" />
        <Card>
          <SettingRow
            title="浏览器智能体工具"
            description="允许浏览器智能体自动执行工具"
          >
            <Toggle checked={browserAgentTools} onChange={toggle('browserAgentTools', setBrowserAgentTools)} />
          </SettingRow>
        </Card>
      </div>

      {/* --- 选中代码时显示工具栏 --- */}
      <div>
        <SectionHeader title="编辑器" />
        <Card>
          <SettingRow
            title="选中代码时显示工具栏"
            description={'在编辑区选中代码时，展示"编辑"和"添加到对话"选项'}
          >
            <Toggle checked={showCodeToolbar} onChange={toggle('showCodeSelectionToolbar', setShowCodeToolbar)} />
          </SettingRow>
        </Card>
      </div>
    </div>
  );
}
