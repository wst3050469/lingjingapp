import { useState, useEffect, useCallback } from 'react';
import { useRemoteStore } from '../../stores/remote-store';
import { useRemoteContextStore } from '../../stores/remote-context-store';
import { useUIStore } from '../../stores/ui-store';
import { useFileStore } from '../../stores/file-store';

interface RemoteEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  mtime?: number;
}

// Simple file icon based on extension
function getFileIcon(name: string): { emoji: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    ts: '🟦', tsx: '⚛️', js: '🟨', jsx: '⚛️', py: '🐍', java: '☕',
    go: '🔵', rs: '🦀', c: '⚙️', cpp: '⚙️', h: '⚙️', hpp: '⚙️',
    html: '🌐', css: '🎨', scss: '🎨', json: '📋', md: '📝',
    sh: '💻', bash: '💻', yml: '📋', yaml: '📋', xml: '📋',
    sql: '🗄️', toml: '⚙️', ini: '⚙️', cfg: '⚙️', conf: '⚙️',
    gitignore: '🙈', env: '🔒', dockerfile: '🐳', lock: '🔒',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
    pdf: '📄', zip: '📦', tar: '📦', gz: '📦',
  };
  const emoji = icons[ext] || '📄';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(ext);
  return { emoji, color: isImage ? 'text-purple-400' : 'text-cp-text-dim' };
}

function formatSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RemoteFolderPicker() {
  const { activeTerminal } = useRemoteStore();
  const { setShowRemoteFolderPicker } = useUIStore();
  const { setRemoteContext } = useRemoteContextStore();
  const { setWorkspacePath, setFileTree } = useFileStore();

  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadEntries = useCallback(async (path: string): Promise<void> => {
    if (!activeTerminal) return;
    setLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const rawEntries = await window.electronAPI.ssh.readDir(activeTerminal.sshTerminalId, path);
      const mapped: RemoteEntry[] = rawEntries.map((e: any) => ({
        name: e.name,
        path: e.path,
        isDirectory: e.isDirectory,
        size: e.size,
        mtime: e.mtime,
      }));
      // Sort: directories first, then alphabetically
      mapped.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(mapped);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.message || '加载目录失败');
    } finally {
      setLoading(false);
    }
  }, [activeTerminal]);

  useEffect(() => {
    if (activeTerminal) {
      const homePath = activeTerminal.username === 'root'
        ? '/root'
        : `/home/${activeTerminal.username}`;
      loadEntries(homePath).catch(() => {
        loadEntries('/');
      });
    }
  }, [activeTerminal, loadEntries]);

  const handleNavigate = (path: string) => {
    loadEntries(path);
  };

  const handleGoUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const parentPath = '/' + parts.join('/');
      loadEntries(parentPath || '/');
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

  const handleDownloadFile = async (entry: RemoteEntry) => {
    if (!activeTerminal || entry.isDirectory) return;
    setDownloading(entry.path);
    setStatusMsg(null);
    try {
      // Read remote file
      const { content } = await window.electronAPI.ssh.readFile(activeTerminal.sshTerminalId, entry.path);
      // Ask user where to save
      const savePath = await window.electronAPI.fs.saveAs(entry.name);
      if (!savePath) { setDownloading(null); return; }
      // Write to local
      await window.electronAPI.fs.writeFile(savePath, content);
      setStatusMsg(`已下载: ${entry.name}`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setError(`下载失败: ${err.message || err}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleUploadFile = async () => {
    if (!activeTerminal) return;
    setUploading(true);
    setStatusMsg(null);
    try {
      // Select local file
      const localPath = await window.electronAPI.fs.selectFile();
      if (!localPath) { setUploading(false); return; }
      // Read local file
      const { content } = await window.electronAPI.fs.readFile(localPath);
      // Extract filename from local path
      const fileName = localPath.replace(/\\/g, '/').split('/').pop() || 'uploaded-file';
      const remotePath = currentPath.endsWith('/')
        ? `${currentPath}${fileName}`
        : `${currentPath}/${fileName}`;
      // Write to remote via SFTP
      await window.electronAPI.ssh.writeFile(activeTerminal.sshTerminalId, remotePath, content);
      setStatusMsg(`已上传: ${fileName}`);
      // Refresh directory
      await loadEntries(currentPath);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setError(`上传失败: ${err.message || err}`);
    } finally {
      setUploading(false);
    }
  };

  if (!activeTerminal) return null;

  const dirs = entries.filter(e => e.isDirectory);
  const files = entries.filter(e => !e.isDirectory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[640px] max-h-[80vh] bg-cp-panel border border-cp-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-cp-border flex-shrink-0">
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
        <div className="px-4 py-2 border-b border-cp-border flex items-center gap-2 flex-shrink-0">
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
          {/* Refresh button */}
          <button
            onClick={() => loadEntries(currentPath)}
            disabled={loading}
            className="p-1 rounded hover:bg-white/10 text-cp-text-dim disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className="px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 text-[11px] text-emerald-400 flex-shrink-0">
            {statusMsg}
          </div>
        )}

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-cp-text-dim">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-cp-accent border-t-transparent rounded-full animate-spin" />
                <span>加载中...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-8">
              <p>{error}</p>
              <button onClick={() => { setError(null); loadEntries(currentPath); }} className="mt-2 text-xs text-cp-accent hover:underline">重试</button>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-cp-text-dim text-center py-8">此目录为空</div>
          ) : (
            <>
              {/* Directories */}
              {dirs.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => handleNavigate(dir.path)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 text-left transition-colors"
                >
                  <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="text-sm text-cp-text truncate flex-1">{dir.name}</span>
                </button>
              ))}
              {/* Separator */}
              {files.length > 0 && dirs.length > 0 && (
                <div className="px-3 py-1 text-[10px] text-cp-text-dim/40 border-t border-cp-border/30 mt-1 pt-1">文件</div>
              )}
              {/* Files */}
              {files.map((file) => {
                const { emoji } = getFileIcon(file.name);
                const isDownloading = downloading === file.path;
                return (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-white/[0.02] group"
                  >
                    <span className="text-sm flex-shrink-0">{emoji}</span>
                    <span className="text-sm text-cp-text-dim truncate flex-1">{file.name}</span>
                    {file.size != null && (
                      <span className="text-[10px] text-cp-text-dim/30 flex-shrink-0 hidden group-hover:hidden sm:inline">
                        {formatSize(file.size)}
                      </span>
                    )}
                    <button
                      onClick={() => handleDownloadFile(file)}
                      disabled={isDownloading}
                      className="text-[10px] px-2 py-0.5 rounded bg-cp-accent/10 text-cp-accent hover:bg-cp-accent/20 disabled:opacity-50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {isDownloading ? '下载中...' : '下载'}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-cp-border flex items-center justify-between gap-3 flex-shrink-0">
          {/* Upload button (left) */}
          <button
            onClick={handleUploadFile}
            disabled={uploading}
            className="px-3 py-1.5 text-xs text-cp-text-dim hover:text-cp-text rounded hover:bg-white/10 disabled:opacity-50 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? '上传中...' : '上传文件'}
          </button>
          {/* Right buttons */}
          <div className="flex items-center gap-3">
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
    </div>
  );
}
