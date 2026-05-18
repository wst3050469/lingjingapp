import { useEffect, useRef } from 'react';
import { useRemoteStore } from '../../stores/remote-store';
import { useUIStore } from '../../stores/ui-store';
import type { SSHTerminalInfo } from '../../stores/remote-store';

interface RemoteMenuProps {
  activeTerminal: SSHTerminalInfo | null;
  onDisconnect: () => void;
  onOpenFolder: () => void;
  onManageConnections: () => void;
  onClose: () => void;
}

export function RemoteMenu({ activeTerminal, onDisconnect, onOpenFolder, onManageConnections, onClose }: RemoteMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { setShowConnectionDialog } = useRemoteStore();
  const { setShowRemoteFolderPicker } = useUIStore();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleConnectToHost = () => {
    onClose();
    // Open sidebar remote panel and show connection dialog
    const { setSidebarPanel } = useUIStore.getState();
    setSidebarPanel('remote');
    setShowConnectionDialog(true);
  };

  const handleOpenRemoteFolder = () => {
    onClose();
    setShowRemoteFolderPicker(true);
  };

  const handleManageConnections = () => {
    onClose();
    onManageConnections();
  };

  const handleDisconnect = () => {
    onClose();
    onDisconnect();
  };

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-1 w-72 bg-cp-panel border border-cp-border rounded-lg shadow-xl overflow-hidden z-50"
    >
      {/* Header */}
      {activeTerminal ? (
        <div className="px-4 py-2.5 border-b border-cp-border bg-green-600/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm text-cp-text font-medium">SSH: {activeTerminal.name}</span>
          </div>
          <div className="text-xs text-cp-text-dim mt-0.5">
            {activeTerminal.username}@{activeTerminal.host}
          </div>
        </div>
      ) : (
        <div className="px-4 py-2.5 border-b border-cp-border">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-cp-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M14.25 3.104v5.714c0 .597.237 1.17.659 1.591L19 14.5M19.8 15.3l-1.402 1.402c1.285 1.286 1.285 3.37 0 4.656l-.47.47a3.288 3.288 0 01-4.656 0l-1.402-1.402M5 14.5l-1.402 1.402a3.288 3.288 0 000 4.656l.47.47c1.286 1.286 3.37 1.286 4.656 0L10.126 19.6M12 18v-3.75m0 0c-.251.023-.501.05-.75.082m.75-.082c.251.023.501.05.75.082" />
            </svg>
            <span className="text-sm text-cp-text-dim">远程连接</span>
          </div>
        </div>
      )}

      {/* Menu items */}
      <div className="py-1">
        {activeTerminal ? (
          <>
            <button
              onClick={handleOpenRemoteFolder}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-cp-text hover:bg-white/10 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-cp-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <span>打开远程文件夹...</span>
            </button>
            <button
              onClick={handleManageConnections}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-cp-text hover:bg-white/10 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-cp-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>SSH 连接管理...</span>
            </button>
            <div className="my-1 border-t border-cp-border" />
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>断开连接</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleConnectToHost}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-cp-text hover:bg-white/10 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-cp-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>连接到主机...</span>
            </button>
            <button
              onClick={handleManageConnections}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-cp-text hover:bg-white/10 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-cp-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>SSH 连接管理...</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
