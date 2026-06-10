import { useState, useEffect } from 'react';

interface DebugConfig {
  name: string;
  type: 'node' | 'npm' | 'custom';
  program?: string;
  cwd?: string;
  args?: string[];
  runtimeExecutable?: string;
}

interface LaunchConfig {
  version: string;
  configurations: DebugConfig[];
}

interface DebugSession {
  id: string;
  configName: string;
  port: number;
  status: string;
  createdAt: number;
}

export function DebugPanel() {
  const [configs, setConfigs] = useState<LaunchConfig>({ version: '0.1.0', configurations: [] });
  const [sessions, setSessions] = useState<DebugSession[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [output, setOutput] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState('');

  useEffect(() => {
    // @ts-ignore -- LaunchConfig interface mismatch with electronAPI return type
    window.electronAPI?.debug?.getConfig().then((cfg: LaunchConfig) => {
      setConfigs(cfg);
    });
    window.electronAPI?.debug?.onOutput?.((evt: { sessionId: string; data: string; stream: string }) => {
      setOutput(prev => [...prev.slice(-500), `[${evt.stream}] ${evt.data}`]);
    });
    window.electronAPI?.debug?.onStatus?.((evt: { sessionId: string; status: string; port?: number; exitCode?: number; error?: string }) => {
      setSessions(prev => prev.map(s =>
        s.id === evt.sessionId ? { ...s, status: evt.status } : s
      ));
      if (evt.status === 'stopped' || evt.status === 'error') {
        setOutput(prev => [...prev, evt.status === 'error'
          ? `[debug] Error: ${evt.error || 'unknown'}`
          : `[debug] Process exited with code ${evt.exitCode ?? '?'}`]);
      }
    });
  }, []);

  const config = configs.configurations[selectedIdx];

  const handleStart = async () => {
    if (!config) return;
    setOutput([]);
    const result = await window.electronAPI?.debug?.start({ config, workspacePath: undefined });
    if (result?.error) {
      setOutput([`[error] ${result.error}`]);
    } else if (result?.sessionId) {
      // @ts-ignore -- result.sessionId/port may be undefined at type level but set at runtime
      setSessions(prev => [...prev, {
        id: result.sessionId,
        configName: config.name,
        port: result.port,
        status: 'starting',
        createdAt: Date.now(),
      }]);
      // Auto-open DevTools after a short delay
      setTimeout(() => {
        window.electronAPI?.debug?.openDevtools({ sessionId: result.sessionId! });
      }, 2000);
    }
  };

  const handleStop = async (sessionId: string) => {
    await window.electronAPI?.debug?.stop({ sessionId });
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleEdit = () => {
    setEditJson(JSON.stringify(configs, null, 2));
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      const parsed = JSON.parse(editJson) as LaunchConfig;
      await window.electronAPI?.debug?.saveConfig(parsed);
      setConfigs(parsed);
      setEditing(false);
    } catch {
      // invalid JSON, keep editing
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-cp-text-dim font-medium border-b border-cp-border flex items-center justify-between">
        <span>运行和调试</span>
        <div className="flex gap-1">
          <button onClick={handleEdit} className="text-[10px] px-2 py-0.5 rounded hover:bg-white/10 text-cp-text-dim">
            launch.json
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex-1 flex flex-col p-3 gap-2">
          <textarea
            value={editJson}
            onChange={e => setEditJson(e.target.value)}
            className="flex-1 text-xs font-mono bg-cp-bg border border-cp-border rounded p-2 text-cp-text resize-none focus:border-cp-accent focus:outline-none"
            spellCheck={false}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 rounded hover:bg-white/10 text-cp-text-dim">取消</button>
            <button onClick={handleSaveEdit} className="text-xs px-2 py-1 rounded bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30">保存</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Config selector + run button */}
          <div className="flex items-center gap-2">
            <select
              value={selectedIdx}
              onChange={e => setSelectedIdx(Number(e.target.value))}
              className="flex-1 text-xs bg-cp-bg border border-cp-border rounded px-2 py-1.5 text-cp-text focus:border-cp-accent focus:outline-none"
            >
              {configs.configurations.map((c, i) => (
                <option key={i} value={i}>{c.name} ({c.type})</option>
              ))}
              {configs.configurations.length === 0 && <option>无配置</option>}
            </select>
            <button
              onClick={handleStart}
              className="px-3 py-1.5 text-xs bg-cp-success/20 text-cp-success hover:bg-cp-success/30 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              调试
            </button>
          </div>

          {/* Config info */}
          {config && (
            <div className="text-[10px] text-cp-text-dim/60 space-y-1 border border-cp-border rounded p-2">
              <div>类型: {config.type}</div>
              {config.program && <div>入口: {config.program}</div>}
              {config.args && config.args.length > 0 && <div>参数: {config.args.join(' ')}</div>}
              {config.runtimeExecutable && <div>运行时: {config.runtimeExecutable}</div>}
            </div>
          )}

          {/* Active sessions */}
          {sessions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-cp-text-dim font-medium">活动会话</div>
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs bg-cp-bg border border-cp-border rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      s.status === 'running' ? 'bg-cp-success' :
                      s.status === 'error' ? 'bg-cp-error' : 'bg-cp-warning'
                    }`} />
                    <span className="text-cp-text">{s.configName}</span>
                    <span className="text-cp-text-dim">:{s.port}</span>
                  </div>
                  <button
                    onClick={() => handleStop(s.id)}
                    className="text-cp-error/70 hover:text-cp-error text-[10px]"
                  >
                    停止
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Output */}
          {output.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-cp-text-dim font-medium">输出</div>
              <div className="text-[10px] font-mono bg-[#1e1e1e] text-cp-text rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {output.join('\n')}
              </div>
            </div>
          )}

          {/* Help text */}
          {configs.configurations.length === 0 && (
            <div className="text-[10px] text-cp-text-dim/40 text-center pt-4">
              点击 launch.json 创建调试配置
            </div>
          )}
        </div>
      )}
    </div>
  );
}
