import { useEffect, useState } from 'react';
import { useRemoteStore, SSHConnection } from '../../stores/remote-store';
import { SSHConnectionDialog } from './SSHConnectionDialog';

export function RemotePanel() {
  const {
    connections,
    loading,
    error,
    loadConnections,
    deleteConnection,
    connect,
    disconnect,
    showConnectionDialog,
    editingConnection,
    setShowConnectionDialog,
    setEditingConnection,
  } = useRemoteStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conn: SSHConnection } | null>(null);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleAdd = () => {
    setEditingConnection(null);
    setShowConnectionDialog(true);
  };

  const handleEdit = (conn: SSHConnection) => {
    setEditingConnection(conn);
    setShowConnectionDialog(true);
    setContextMenu(null);
  };

  const handleDelete = async (conn: SSHConnection) => {
    if (confirm(`确定要删除连接 "${conn.name}" 吗？`)) {
      await deleteConnection(conn.id);
    }
    setContextMenu(null);
  };

  const handleConnect = async (conn: SSHConnection) => {
    const { activeTerminal } = useRemoteStore.getState();
    
    // If clicking the already connected terminal, do nothing
    if (activeTerminal && activeTerminal.connectionId === conn.id && conn.status === 'connected') {
      setContextMenu(null);
      return;
    }
    
    // If there's an active connection, disconnect first
    if (activeTerminal) {
      await disconnect();
    }
    
    // Connect to the new terminal
    await connect(conn.id);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, conn: SSHConnection) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, conn });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    document.addEventListener('click', closeContextMenu);
    return () => document.removeEventListener('click', closeContextMenu);
  }, []);

  return (
    <div className="h-full flex flex-col bg-cp-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cp-border">
        <h2 className="text-sm font-semibold text-cp-text">远程资源管理器</h2>
        <button
          onClick={handleAdd}
          className="text-xs text-cp-text-dim hover:text-white transition-colors"
          title="添加连接"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Connection List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && connections.length === 0 ? (
          <div className="text-xs text-cp-text-dim text-center py-4">加载中...</div>
        ) : error ? (
          <div className="text-xs text-red-400 text-center py-4">{error}</div>
        ) : connections.length === 0 ? (
          <div className="text-xs text-cp-text-dim text-center py-8">
            <p>暂无远程连接</p>
            <p className="mt-1">点击上方 + 按钮添加</p>
          </div>
        ) : (
          <div className="space-y-1">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                onClick={() => handleConnect(conn)}
                onContextMenu={(e) => handleContextMenu(e, conn)}
              >
                {/* Status indicator */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  conn.status === 'connected' ? 'bg-green-400' :
                  conn.status === 'connecting' ? 'bg-amber-400 animate-pulse' :
                  'bg-cp-text-dim/30'
                }`} />

                {/* Connection info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-cp-text truncate">{conn.name}</div>
                  <div className="text-[10px] text-cp-text-dim truncate">
                    {conn.username}@{conn.host}:{conn.port}
                  </div>
                </div>

                {/* Quick connect button */}
                {conn.status !== 'connecting' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnect(conn);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-cp-text-dim hover:text-white transition-opacity"
                    title={conn.status === 'connected' ? '断开' : '连接'}
                  >
                    {conn.status === 'connected' ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m6-5a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-cp-panel border border-cp-border rounded shadow-lg py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleConnect(contextMenu.conn)}
            className="w-full text-left px-3 py-1.5 text-xs text-cp-text hover:bg-white/10"
          >
            {contextMenu.conn.status === 'connected' ? '断开连接' : '连接'}
          </button>
          <button
            onClick={() => handleEdit(contextMenu.conn)}
            className="w-full text-left px-3 py-1.5 text-xs text-cp-text hover:bg-white/10"
          >
            编辑
          </button>
          <button
            onClick={() => handleDelete(contextMenu.conn)}
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-white/10"
          >
            删除
          </button>
        </div>
      )}

      {/* Connection Dialog */}
      {showConnectionDialog && (
        <SSHConnectionDialog
          connection={editingConnection}
          onClose={() => {
            setShowConnectionDialog(false);
            setEditingConnection(null);
          }}
        />
      )}
    </div>
  );
}
