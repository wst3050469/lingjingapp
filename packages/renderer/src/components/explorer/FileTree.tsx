import { useEffect, useState, useCallback } from 'react';
import { useFileStore } from '../../stores/file-store';
import { useEditorStore } from '../../stores/editor-store';
import { useRemoteContextStore } from '../../stores/remote-context-store';
import { ContextMenu, type ContextMenuItem } from '../shared/ContextMenu';
import { SendFileDialog } from '../email/SendFileDialog';
import type { FileEntry } from '../../ipc/ipc-client';

export function FileTree() {
  const { workspacePath, fileTree, setFileTree, setWorkspacePath, readDir, readFile } = useFileStore();
  const { isRemoteMode, remoteWorkspacePath, connectionName, host, username } = useRemoteContextStore();

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.fs.selectFolder();
    if (path) {
      setWorkspacePath(path);
      const entries = await readDir(path);
      setFileTree(entries);
    }
  };

  const handleOpenRemoteFolder = async () => {
    // Import dynamically to avoid circular dependency
    const { useRemoteStore } = await import('../../stores/remote-store');
    const { activeTerminal } = useRemoteStore.getState();
    if (!activeTerminal) return;
    
    // Trigger remote folder picker
    const { useUIStore } = await import('../../stores/ui-store');
    useUIStore.getState().setShowRemoteFolderPicker(true);
  };

  // On mount: restore last saved workspace from main process config
  useEffect(() => {
    const restore = async () => {
      try {
        const savedPath = await window.electronAPI.config.getWorkspace();
        if (savedPath && savedPath !== workspacePath) {
          setWorkspacePath(savedPath);
          const entries = await readDir(savedPath);
          setFileTree(entries);
        }
      } catch { /* ignore */ }
    };
    restore();
  }, []);

  useEffect(() => {
    if (workspacePath) {
      readDir(workspacePath).then(setFileTree);
    }
  }, [workspacePath]);

  // When remote workspace changes
  useEffect(() => {
    if (isRemoteMode && remoteWorkspacePath) {
      setWorkspacePath(remoteWorkspacePath);
      readDir(remoteWorkspacePath).then(setFileTree);
    }
  }, [isRemoteMode, remoteWorkspacePath]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-cp-border flex items-center justify-between">
        {isRemoteMode ? (
          <>
            <span className="text-xs font-semibold text-green-400 truncate max-w-[180px]" title={`${connectionName} (${username}@${host})`}>
              SSH: {remoteWorkspacePath || '未选择文件夹'}
            </span>
            <button
              onClick={handleOpenRemoteFolder}
              className="text-cp-text-dim hover:text-cp-text text-xs px-2 py-0.5 rounded hover:bg-white/10 flex-shrink-0"
            >
              选择文件夹
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-semibold uppercase tracking-wide text-cp-text-dim">Explorer</span>
            <button
              onClick={handleOpenFolder}
              className="text-cp-text-dim hover:text-cp-text text-xs px-2 py-0.5 rounded hover:bg-white/10"
            >
              Open Folder
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto text-sm">
        {!workspacePath ? (
          <div className="p-4 text-center text-cp-text-dim text-xs">
            <p className="mb-2">{isRemoteMode ? '未选择远程文件夹' : 'No folder opened'}</p>
            <button
              onClick={isRemoteMode ? handleOpenRemoteFolder : handleOpenFolder}
              className="px-3 py-1.5 bg-cp-accent text-cp-text rounded text-xs hover:bg-cp-accent/80"
            >
              {isRemoteMode ? '选择远程文件夹' : 'Open Folder'}
            </button>
          </div>
        ) : (
          fileTree.map((entry) => (
            <FileTreeItem key={entry.path} entry={entry} depth={0} />
          ))
        )}
      </div>
    </div>
  );
}

function FileTreeItem({ entry, depth }: { entry: FileEntry; depth: number }) {
  const { expandedPaths, toggleExpanded, readDir, readFile } = useFileStore();
  const isExpanded = expandedPaths.has(entry.path);

  // 右键菜单状态
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  // 发送文件弹窗状态
  const [sendDialog, setSendDialog] = useState<{ open: boolean; filePath: string; fileName: string }>({
    open: false, filePath: '', fileName: '',
  });

  const handleClick = async () => {
    if (entry.isDirectory) {
      toggleExpanded(entry.path);
      if (!isExpanded && (!entry.children || entry.children.length === 0)) {
        const children = await readDir(entry.path);
        entry.children = children;
        useFileStore.getState().setFileTree([...useFileStore.getState().fileTree]);
      }
    } else {
      try {
        const { content, language } = await readFile(entry.path);
        useEditorStore.getState().openFile({
          path: entry.path,
          name: entry.name,
          language,
          content,
          isDirty: false,
        });
      } catch (err) {
        console.error('Failed to open file:', err);
      }
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleSendEmail = () => {
    setSendDialog({ open: true, filePath: entry.path, fileName: entry.name });
  };

  const menuItems: ContextMenuItem[] = [
    { label: '通过邮件发送', icon: '📧', action: handleSendEmail },
  ];

  // 文件夹也可以右键打开（虽然没有实际意义，保持一致性）
  if (!entry.isDirectory) {
    // 只有文件才有邮件发送选项
  }

  const icon = entry.isDirectory ? (isExpanded ? '\u25BE' : '\u25B8') : '\u00A0\u00A0';

  return (
    <>
      <div
        className="flex items-center px-1 py-0.5 cursor-pointer hover:bg-white/5 select-none"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="text-cp-text-dim text-xs w-4 flex-shrink-0">{icon}</span>
        <span className={`ml-1 truncate ${entry.isDirectory ? 'text-cp-text' : 'text-cp-text-dim'}`}>
          {entry.name}
        </span>
      </div>
      {entry.isDirectory && isExpanded && entry.children?.map((child) => (
        <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
      ))}

      {/* 右键菜单 */}
      <ContextMenu
        open={ctxMenu !== null}
        x={ctxMenu?.x ?? 0}
        y={ctxMenu?.y ?? 0}
        items={menuItems}
        onClose={() => setCtxMenu(null)}
      />

      {/* 发送文件弹窗 */}
      <SendFileDialog
        open={sendDialog.open}
        filePath={sendDialog.filePath}
        fileName={sendDialog.fileName}
        onClose={() => setSendDialog({ open: false, filePath: '', fileName: '' })}
      />
    </>
  );
}
