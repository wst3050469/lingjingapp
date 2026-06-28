interface InputToolbarProps {
  onImage?: () => void;
  onVoice?: () => void;
  onPolish?: () => void;
  onSend: () => void;
  onStop?: () => void;
  isStreaming: boolean;
  isRecording?: boolean;
  isPolishing?: boolean;
  canSend: boolean;
}

export function InputToolbar({
  onImage, onVoice, onPolish, onSend, onStop,
  isStreaming, isRecording = false, isPolishing = false, canSend,
}: InputToolbarProps) {
  const handleImage = () => {
    console.log('[InputToolbar] Image button clicked');
    onImage?.();
  };

  const handleVoice = () => {
    console.log('[InputToolbar] Voice button clicked');
    onVoice?.();
  };

  const handlePolish = () => {
    console.log('[InputToolbar] Polish button clicked');
    onPolish?.();
  };

  return (
    <div className="flex items-center justify-between px-2 pb-1.5">
      <div className="flex items-center gap-0.5">
        {/* File upload */}
        {onImage && (
          <ToolbarBtn title="上传文件" onClick={handleImage}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </ToolbarBtn>
        )}

        {/* Voice input */}
        {onVoice && (
          <ToolbarBtn title={isRecording ? '停止录音' : '语音输入'} onClick={handleVoice} active={isRecording}>
            <svg className={`w-3.5 h-3.5 ${isRecording ? 'text-red-400' : ''}`} fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            {isRecording && (
              <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
            )}
          </ToolbarBtn>
        )}

        {/* Polish */}
        {onPolish && (
          <ToolbarBtn title="润色提示词" onClick={handlePolish} active={isPolishing}>
            {isPolishing ? (
              <span className="w-3.5 h-3.5 border-2 border-cp-accent border-t-transparent rounded-full animate-spin block" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            )}
          </ToolbarBtn>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Stop button (streaming) */}
        {isStreaming && onStop && (
          <button
            onClick={onStop}
            title="停止"
            className="w-5 h-5 flex items-center justify-center rounded text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}

        {/* Send button */}
        {!isStreaming && (
          <button
            onClick={onSend}
            disabled={!canSend}
            className="px-2 py-1 bg-cp-accent text-white rounded text-[10px]
              hover:bg-cp-accent/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({ children, title, onClick, active }: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.();
  };

  return (
    <button
      type="button"
      title={title}
      onClick={handleClick}
      className={`relative w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
        active
          ? 'text-cp-accent bg-cp-accent/10'
          : 'text-cp-text-dim/50 hover:text-cp-text hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}
