interface InputToolbarProps {
  onPolish: () => void;
  onSend: () => void;
  isStreaming: boolean;
  isPolishing: boolean;
  canSend: boolean;
}

export function InputToolbar({
  onPolish, onSend,
  isStreaming, isPolishing, canSend,
}: InputToolbarProps) {
  const handlePolish = () => {
    console.log('[InputToolbar] Polish button clicked');
    onPolish();
  };

  return (
    <div className="flex items-center justify-between px-2 pb-1.5">
      <div className="flex items-center gap-0.5">
        {/* Polish */}
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
      </div>

      <div>
        {isStreaming ? (
          <span className="text-[10px] text-cp-text-dim/30 px-2">
            等待中...
          </span>
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
    onClick?.();
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
