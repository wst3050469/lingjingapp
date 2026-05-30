interface InputToolbarProps {
  onMention: () => void;
  onImage: () => void;
  onVoice: () => void;
  onPolish: () => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  isRecording: boolean;
  isPolishing: boolean;
  canSend: boolean;
}

export function InputToolbar({
  onMention, onImage, onVoice, onPolish, onSend, onStop,
  isStreaming, isRecording, isPolishing, canSend,
}: InputToolbarProps) {
  const handleMention = () => {
    console.log('[InputToolbar] Mention button clicked');
    onMention();
  };
  
  const handleImage = () => {
    console.log('[InputToolbar] Image button clicked');
    onImage();
  };
  
  const handleVoice = () => {
    console.log('[InputToolbar] Voice button clicked');
    onVoice();
  };
  
  const handlePolish = () => {
    console.log('[InputToolbar] Polish button clicked');
    onPolish();
  };
  
  return (
    <div className="flex items-center justify-between px-2 pb-1.5">
      <div className="flex items-center gap-0.5">
        {/* @ Mention */}
        <ToolbarBtn title="@ 提及文件" onClick={handleMention}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
          </svg>
        </ToolbarBtn>
        {/* Image */}
        <ToolbarBtn title="上传图片" onClick={handleImage}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </ToolbarBtn>
        {/* Voice */}
        <ToolbarBtn title={isRecording ? '停止录音' : '语音输入'} onClick={handleVoice} active={isRecording}>
          <svg className={`w-3.5 h-3.5 ${isRecording ? 'text-red-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </ToolbarBtn>
        {/* Polish */}
        <ToolbarBtn title="润色提示词" onClick={handlePolish} active={isPolishing}>
          {isPolishing ? (
            <span className="w-3.5 h-3.5 border-2 border-cp-accent border-t-transparent rounded-full animate-spin block" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          )}
        </ToolbarBtn>
      </div>

      <div>
        {isStreaming ? (
          <button
            onClick={onStop}
            className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-[10px] hover:bg-red-500/30 transition-colors"
          >
            停止
          </button>
        ) : (
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
    console.log('[ToolbarBtn] Button clicked:', title, 'onClick exists:', !!onClick);
    if (onClick) {
      onClick();
    } else {
      console.error('[ToolbarBtn] No onClick handler for:', title);
    }
  };
  
  return (
    <button
      type="button"
      title={title}
      onClick={handleClick}
      className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
        active
          ? 'text-cp-accent bg-cp-accent/10'
          : 'text-cp-text-dim/50 hover:text-cp-text hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}
