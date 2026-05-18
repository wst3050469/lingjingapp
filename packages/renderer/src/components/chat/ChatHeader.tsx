import { useUIStore } from '../../stores/ui-store';
import { ModelSelector } from './ModelSelector';

export function ChatHeader() {
  const { openRightPanel, showRightPanel, toggleRightPanel, setShowSettingsModal } = useUIStore();

  return (
    <div className="h-12 border-b border-cp-border flex items-center justify-between px-4 shrink-0">
      {/* Left: Model selector */}
      <ModelSelector />

      {/* Right: Action buttons */}
      <div className="flex items-center gap-1">
        <HeaderButton
          title="Files"
          active={showRightPanel}
          onClick={() => openRightPanel('files')}
        >
          &#128193;
        </HeaderButton>
        <HeaderButton
          title="Terminal"
          onClick={() => openRightPanel('terminal')}
        >
          &gt;_
        </HeaderButton>
        <HeaderButton
          title="Settings"
          onClick={() => setShowSettingsModal(true)}
        >
          &#9881;
        </HeaderButton>
      </div>
    </div>
  );
}

function HeaderButton({ children, title, active, onClick }: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-colors
        ${active ? 'text-cp-text bg-cp-surface' : 'text-cp-text-dim hover:text-cp-text hover:bg-white/5'}`}
    >
      {children}
    </button>
  );
}
