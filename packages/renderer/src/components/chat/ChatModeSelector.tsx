import { useChatStore, type ChatMode } from '../../stores/chat-store';

const MODES: { value: ChatMode; label: string; disabled?: boolean; tooltip: string }[] = [
  { value: 'ask', label: 'Ask', tooltip: '智能问答 - 回答问题、解释代码、审查优化' },
  { value: 'agent', label: 'Agent', tooltip: '智能体 - 自主执行代码修改和文件操作' },
  { value: 'experts', label: 'Experts', tooltip: '专家团模式 - 多专家协作完成复杂任务' },
  { value: 'research', label: 'Research', tooltip: '智能研究 - 深度思考 + 联网搜索，适合需要调研分析的复杂问题' },
];

export function ChatModeSelector() {
  const { chatMode, setChatMode } = useChatStore();

  return (
    <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-md p-0.5">
      {MODES.map((m) => (
        <button
          key={m.value}
          onClick={() => !m.disabled && setChatMode(m.value)}
          disabled={m.disabled}
          title={m.tooltip}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            chatMode === m.value
              ? 'bg-cp-accent text-cp-text font-semibold'
              : m.disabled
                ? 'text-white/40 cursor-not-allowed'
                : 'text-white/70 hover:text-cp-text hover:bg-white/[0.08]'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
