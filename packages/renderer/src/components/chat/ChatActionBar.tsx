/**
 * ChatActionBar — 输入栏上方操作条
 * 集成：文件上传、语音输入、停止任务
 * 桌面端对齐移动端 ChatDetailScreen Action Bar
 */

interface ChatActionBarProps {
  onFileUpload?: () => void;
  onVoice?: () => void;
  onStop?: () => void;
  isRecording?: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
}

export function ChatActionBar({
  onFileUpload,
  onVoice,
  onStop,
  isRecording = false,
  isStreaming = false,
  disabled = false,
}: ChatActionBarProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.04]">
      {/* 文件上传 */}
      <ActionBtn
        title="上传文件"
        onClick={onFileUpload}
        disabled={disabled}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-[10px]">文件</span>
      </ActionBtn>

      {/* 语音输入 */}
      <ActionBtn
        title={isRecording ? '停止录音' : '语音输入'}
        onClick={onVoice}
        active={isRecording}
        disabled={disabled}
      >
        <svg className={`w-4 h-4 ${isRecording ? 'text-red-400' : ''}`} fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
        <span className={`text-[10px] ${isRecording ? 'text-red-400' : ''}`}>
          {isRecording ? '录音中' : '语音'}
        </span>
      </ActionBtn>

      {/* 弹性空间 */}
      <div className="flex-1" />

      {/* 任务状态指示 + 停止按钮 */}
      {isStreaming ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-cp-accent/80">
            <span className="w-1.5 h-1.5 rounded-full bg-cp-accent animate-pulse" />
            执行中
          </span>
          <ActionBtn
            title="停止任务"
            onClick={onStop}
            active
          >
            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="text-[10px] text-red-400">停止</span>
          </ActionBtn>
        </div>
      ) : (
        <span className="text-[10px] text-cp-text-dim/30">
          就绪
        </span>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  title,
  onClick,
  active = false,
  disabled = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs
        transition-colors cursor-pointer select-none
        ${active
          ? 'text-cp-accent bg-cp-accent/10'
          : 'text-cp-text-dim/60 hover:text-cp-text hover:bg-white/5'
        }
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
}
