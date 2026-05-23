import { useState, useEffect, useCallback } from 'react';
import { useRemoteStore } from '../../stores/remote-store';
import { useRemoteContextStore } from '../../stores/remote-context-store';
import { useUIStore } from '../../stores/ui-store';
import { useFileStore } from '../../stores/file-store';

interface RemoteFolderEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export function RemoteFolderPicker() {
  const { activeTerminal } = useRemoteStore();
  const { setShowRemoteFolderPicker } = useUIStore();
  const { setRemoteContext } = useRemoteContextStore();
  const { setWorkspacePath, setFileTree } = useFileStore();

  const [currentPath, setCurrentPath] = useState('/');
  const [folders, setFolders] = useState<RemoteFolderEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFolders = useCallback(async (path: string): Promise<void> => {
    if (!activeTerminal) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await window.electronAPI.ssh.readDir(activeTerminal.sshTerminalId, path);
      const dirEntries = entries
        .filter((e: any) => e.isDirectory)
        .map((e: any) => ({ name: e.name, path: e.path, isDirectory: true }));
      setFolders(dirEntries);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.message || '加载目录失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeTerminal]);

  useEffect(() => {
    if (activeTerminal) {
      // Try to detect home directory, fallback to /root for root user or /home/username
      const homePath = activeTerminal.username === 'root' 
        ? '/root' 
        : `/home/${activeTerminal.username}`;
      
      // Try to load the home directory, if it fails, start from /
      loadFolders(homePath).catch(() => {
        loadFolders('/');
      });
    }
  }, [activeTerminal, loadFolders]);

  const handleNavigate = (path: string) => {
    loadFolders(path);
  };

  const handleGoUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const parentPath = '/' + parts.join('/');
      loadFolders(parentPath || '/');
    }
  };

  const handleSelectFolder = async () => {
    if (!activeTerminal) return;
    try {
      await window.electronAPI.ssh.setWorkspace(activeTerminal.sshTerminalId, currentPath);
      setRemoteContext({
        sshTerminalId: activeTerminal.sshTerminalId,
        connectionId: activeTerminal.connectionId,
        remoteWorkspacePath: currentPath,
        connectionName: activeTerminal.name,
        host: activeTerminal.host,
        username: activeTerminal.username,
      });
      setWorkspacePath(currentPath);
      setShowRemoteFolderPicker(false);
    } catch (err: any) {
      setError(err.message || '设置工作区失败');
    }
  };

  if (!activeTerminal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[600px] bg-cp-panel border border-cp-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-cp-border">
          <h2 className="text-cp-text font-semibold">选择远程文件夹</h2>
          <button
            onClick={() => setShowRemoteFolderPicker(false)}
            className="text-cp-text-dim hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Path bar */}
        <div className="px-4 py-2 border-b border-cp-border flex items-center gap-2">
          <button
            onClick={handleGoUp}
            disabled={currentPath === '/'}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-cp-text-dim"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <div className="flex-1 px-3 py-1.5 bg-cp-panel rounded text-sm text-cp-text font-mono truncate">
            {currentPath}
          </div>
        </div>

        {/* Folder list */}
        <div className="h-[320px] overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center h-full text-cp-text-dim">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-cp-accent border-t-transparent rounded-full animate-spin" />
                <span>加载中...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-8">{error}</div>
          ) : folders.length === 0 ? (
            <div className="text-cp-text-dim text-center py-8">此目录为空</div>
          ) : (
            folders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => handleNavigate(folder.path)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 text-left transition-colors"
              >
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <span className="text-sm text-cp-text truncate">{folder.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-cp-border flex items-center justify-end gap-3">
          <button
            onClick={() => setShowRemoteFolderPicker(false)}
            className="px-4 py-1.5 text-sm text-cp-text-dim hover:text-white rounded hover:bg-white/10"
          >
            取消
          </button>
          <button
            onClick={handleSelectFolder}
            className="px-4 py-1.5 text-sm bg-cp-accent text-white rounded hover:bg-cp-accent/80"
          >
            选择此文件夹
          </button>
        </div>
      </div>
    </div>
  );
}
