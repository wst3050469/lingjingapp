import React, { useState, useEffect } from 'react';

interface OpenSpaceProcess {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  script?: string;
  startedAt?: string;
}

export function OpenSpacePanel() {
  const [processes, setProcesses] = useState<OpenSpaceProcess[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await (window as any).electron?.invoke('openspace:check-connection');
        setConnected(!!res);
      } catch { setConnected(false); }
    };
    check();
    const iv = setInterval(check, 10000);
    return () => clearInterval(iv);
  }, []);

  const refreshProcesses = async () => {
    setLoading(true);
    try {
      const list = await (window as any).electron?.invoke('openspace:list-processes');
      setProcesses(list || []);
    } catch { setProcesses([]); }
    setLoading(false);
  };

  const startProcess = async (script: string) => {
    try {
      await (window as any).electron?.invoke('openspace:execute', { script, language: 'lua' });
      await refreshProcesses();
    } catch (err) { console.error('OpenSpace execute failed:', err); }
  };

  const stopProcess = async (id: string) => {
    try {
      await (window as any).electron?.invoke('openspace:stop-process', { processId: id });
      await refreshProcesses();
    } catch (err) { console.error('Stop process failed:', err); }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cp-text">OpenSpace 宇宙</h2>
        <span className={`text-xs px-2 py-0.5 rounded ${connected ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
          {connected ? '已连接' : '未连接'}
        </span>
      </div>
      <div className="flex gap-2">
        <button onClick={refreshProcesses} disabled={loading} className="px-3 py-1 text-xs rounded bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 disabled:opacity-50">
          {loading ? '刷新中...' : '刷新进程'}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {processes.length === 0 ? (
          <div className="text-cp-text-dim/50 text-xs text-center py-8">暂无活跃进程</div>
        ) : (
          processes.map(p => (
            <div key={p.id} className="flex items-center justify-between px-2 py-1.5 border-b border-cp-border/30">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${p.status === 'running' ? 'bg-emerald-400' : p.status === 'error' ? 'bg-red-400' : 'bg-gray-500'}`} />
                <span className="text-xs text-cp-text">{p.name}</span>
              </div>
              {p.status === 'running' && (
                <button onClick={() => stopProcess(p.id)} className="text-xs text-red-400 hover:text-red-300">停止</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
