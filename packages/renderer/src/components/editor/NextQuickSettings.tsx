import { useState, useRef, useEffect } from 'react';
import { useNextStore } from '../../stores/next-store';

interface NextQuickSettingsProps {
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function NextQuickSettings({ onClose, anchorRef }: NextQuickSettingsProps) {
  const { enabled, triggerInComments, autoImport, setEnabled, setTriggerInComments, setAutoImport } = useNextStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleToggle = async (key: string, value: boolean) => {
    switch (key) {
      case 'enabled':
        setEnabled(value);
        break;
      case 'triggerInComments':
        setTriggerInComments(value);
        break;
      case 'autoImport':
        setAutoImport(value);
        break;
    }
    try {
      await window.electronAPI.config.set(`next.${key}`, value);
    } catch {
      // ignore config save errors
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute bottom-7 right-0 w-64 bg-cp-surface border border-cp-border/50 rounded-lg shadow-xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-cp-border/30 flex items-center justify-between">
        <span className="text-xs font-medium text-cp-text">NEXT 设置</span>
        <button
          onClick={onClose}
          className="text-cp-text-dim/50 hover:text-white text-xs"
        >
          &times;
        </button>
      </div>

      {/* Settings */}
      <div className="p-2 space-y-1">
        <QuickToggle
          label="启用 NEXT"
          checked={enabled}
          onChange={(v) => handleToggle('enabled', v)}
        />
        <QuickToggle
          label="注释中触发"
          checked={triggerInComments}
          onChange={(v) => handleToggle('triggerInComments', v)}
        />
        <QuickToggle
          label="自动导入"
          checked={autoImport}
          onChange={(v) => handleToggle('autoImport', v)}
        />
      </div>

      {/* Footer link */}
      <div className="px-3 py-1.5 border-t border-cp-border/30">
        <button
          onClick={() => {
            // Open full settings - dispatch a custom event
            window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'next' } }));
            onClose();
          }}
          className="text-[10px] text-cp-accent hover:text-cp-accent/80 transition-colors"
        >
          打开完整设置 &rarr;
        </button>
      </div>
    </div>
  );
}

function QuickToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
    >
      <span className="text-[11px] text-cp-text-dim">{label}</span>
      <div
        className={`relative w-7 h-4 rounded-full transition-colors ${
          checked ? 'bg-green-500' : 'bg-white/10'
        }`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}
