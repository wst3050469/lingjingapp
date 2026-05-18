import { useEffect } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { SettingsPanel } from './SettingsPanel';
import { SystemStatus } from './SystemStatus';

export function SettingsModal() {
  const { showSettingsModal, setShowSettingsModal } = useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettingsModal(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!showSettingsModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowSettingsModal(false);
      }}
    >
      <div className="w-[780px] max-w-[90vw] h-[80vh] bg-cp-panel border border-cp-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-cp-border shrink-0">
          <h2 className="text-cp-text font-semibold">{'\u8BBE\u7F6E'}</h2>
          <button
            onClick={() => setShowSettingsModal(false)}
            className="text-cp-text-dim hover:text-cp-text text-xl transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Content: sidebar + tab content */}
        <div className="flex-1 overflow-hidden">
          <SettingsPanel />
        </div>

        {/* System Status Bar */}
        <div className="px-6 py-2 border-t border-cp-border bg-cp-bg/50 shrink-0">
          <SystemStatus showUpdateStatus={true} showMemoryStatus={true} />
        </div>
      </div>
    </div>
  );
}
