import { useUIStore, type BottomTab } from '../../stores/ui-store';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { SSHTerminalPanel } from '../terminal/SSHTerminalPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { ProblemsPanel } from '../problems/ProblemsPanel';

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'terminal', label: '终端' },
  { id: 'ssh-terminal', label: 'SSH 终端' },
  { id: 'problems', label: '问题' },
  { id: 'chat', label: 'AI 对话' },
];

export function BottomPanel() {
  const { activeBottomTab, setActiveBottomTab, toggleBottomPanel } = useUIStore();

  return (
    <div className="h-full flex flex-col bg-cp-panel border-t border-cp-border">
      {/* Tab bar */}
      <div className="h-9 flex items-center border-b border-cp-border shrink-0 px-2">
        <div className="flex items-center gap-0.5 flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveBottomTab(tab.id)}
              className={`px-3 py-1 text-[11px] uppercase tracking-wide transition-colors rounded-t ${
                activeBottomTab === tab.id
                  ? 'text-cp-text border-b-2 border-cp-accent'
                  : 'text-cp-text-dim/50 hover:text-cp-text-dim'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={toggleBottomPanel}
          title="关闭面板 (Ctrl+J)"
          className="w-6 h-6 flex items-center justify-center text-cp-text-dim/40 hover:text-cp-text transition-colors rounded"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeBottomTab === 'terminal' && <TerminalPanel />}
        {activeBottomTab === 'ssh-terminal' && <SSHTerminalPanel />}
        {activeBottomTab === 'problems' && <ProblemsPanel />}
        {activeBottomTab === 'chat' && <ChatPanel compact />}
      </div>
    </div>
  );
}
