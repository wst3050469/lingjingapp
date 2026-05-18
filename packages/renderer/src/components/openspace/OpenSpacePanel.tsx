import React, { useState, useEffect, useCallback } from 'react';

interface OpenSpaceStatus {
  initialized: boolean;
  running: boolean;
  processState: string;
  bridgeConnected: boolean;
  installed: boolean;
  compatible: boolean;
  wsPort: number | null;
  [key: string]: any;
}

interface OpenSpaceProfile {
  name: string;
  path?: string;
  modules?: string[];
  metadata?: Record<string, string>;
  [key: string]: any;
}

interface InvokeResult<T = any> {
  success: boolean;
  error?: string;
  status?: OpenSpaceStatus;
  profiles?: OpenSpaceProfile[];
  result?: T;
  duration?: number;
}

function invoke<T = any>(channel: string, ...args: any[]): Promise<InvokeResult<T>> {
  const api = (window as any).electronAPI;
  if (api?.invoke) {
    return api.invoke(channel, ...args);
  }
  return Promise.resolve({ success: false, error: 'electronAPI.invoke not available' });
}

export const OpenSpacePanel: React.FC = () => {
  const [status, setStatus] = useState<OpenSpaceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState('');
  const [scriptResult, setScriptResult] = useState('');
  const [profiles, setProfiles] = useState<OpenSpaceProfile[]>([]);
  const [error, setError] = useState('');

  const refreshStatus = useCallback(async () => {
    try {
      const result = await invoke<OpenSpaceStatus>('openspace:status');
      if (result.success && result.status) {
        setStatus(result.status);
      }
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(refreshStatus, 5000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  const detect = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await invoke('openspace:detect');
      if (!result.success) setError(result.error ?? 'Detection failed');
      await refreshStatus();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await invoke('openspace:start');
      if (!result.success) setError(result.error ?? 'Start failed');
      await refreshStatus();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const stop = async () => {
    setLoading(true);
    setError('');
    try {
      await invoke('openspace:stop');
      await refreshStatus();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const executeScript = async () => {
    if (!script.trim()) return;
    setScriptResult('');
    try {
      const result = await invoke('openspace:execute', { script, language: 'lua' });
      if (result.success) {
        setScriptResult(JSON.stringify(result.result, null, 2));
      } else {
        setScriptResult(`Error: ${result.error}`);
      }
    } catch (err: any) {
      setScriptResult(`Error: ${err.message}`);
    }
  };

  const loadProfiles = async () => {
    try {
      const result = await invoke<OpenSpaceProfile[]>('openspace:list-profiles');
      if (result.success && result.profiles) {
        setProfiles(result.profiles);
      }
    } catch {
      // ignore
    }
  };

  const loadProfile = async (name: string) => {
    setError('');
    try {
      const result = await invoke('openspace:load-profile', name);
      if (!result.success) setError(result.error ?? `Failed to load profile: ${name}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusColor = (): string => {
    if (!status) return '#666';
    if (status.running && status.bridgeConnected) return '#4caf50';
    if (status.running) return '#ff9800';
    return '#f44336';
  };

  return (
    <div style={{ padding: 16, fontFamily: "'Segoe UI', monospace", fontSize: 13 }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>🔭</span>
          <strong style={{ fontSize: 15 }}>OpenSpace</strong>
          <span
            style={{
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: getStatusColor(), display: 'inline-block',
              transition: 'background-color 0.3s',
            }}
          />
          <span style={{ fontSize: 11, color: '#999' }}>
            {status?.processState ?? 'unknown'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={detect} disabled={loading} style={btnStyle}>
          {loading ? '...' : '检测'}
        </button>
        <button onClick={start} disabled={loading || status?.running} style={btnStyle}>
          启动
        </button>
        <button onClick={stop} disabled={loading || !status?.running} style={btnStyle}>
          停止
        </button>
        <button onClick={loadProfiles} style={btnStyle}>
          预置场景
        </button>
      </div>

      {/* Status Info */}
      {status && (
        <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 12 }}>
          <StatusRow label="安装" value={status.installed ? '✅ 已安装' : '❌ 未安装'} />
          <StatusRow label="兼容" value={status.compatible ? '✅ 兼容' : '❌ 不兼容'} />
          <StatusRow
            label="WebSocket"
            value={status.bridgeConnected ? '✅ 已连接' : '❌ 未连接'}
          />
          {status.wsPort && <StatusRow label="端口" value={String(status.wsPort)} />}
          <StatusRow label="初始化" value={status.initialized ? '✅' : '❌'} />
        </div>
      )}

      {/* Profiles Section */}
      {profiles.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>
            预置场景
          </div>
          {profiles.map((p, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', marginBottom: 4,
                background: '#2a2a2a', borderRadius: 4, cursor: 'pointer',
              }}
              onClick={() => loadProfile(p.name)}
              title={`加载场景: ${p.name}`}
            >
              <span>📋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#888' }}>
                  {p.metadata?.description ?? p.path ?? ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Script Execution */}
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>
          Lua 脚本执行
        </div>
        <textarea
          value={script}
          onChange={e => setScript(e.target.value)}
          placeholder="openspace.setPropertyValue('NavigationHandler.Target', 'Mars')"
          rows={3}
          style={{
            width: '100%', fontFamily: 'monospace', fontSize: 12,
            resize: 'vertical', background: '#1e1e1e', color: '#d4d4d4',
            border: '1px solid #3c3c3c', borderRadius: 4, padding: 6,
            outline: 'none',
          }}
        />
        <button
          onClick={executeScript}
          disabled={!script.trim()}
          style={{ ...btnStyle, marginTop: 6 }}
        >
          执行
        </button>
        {scriptResult && (
          <pre
            style={{
              fontSize: 11, background: '#1e1e1e', color: '#d4d4d4',
              padding: 8, borderRadius: 4, marginTop: 6,
              overflow: 'auto', maxHeight: 200,
              border: '1px solid #3c3c3c',
            }}
          >
            {scriptResult}
          </pre>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            color: '#f44336', marginTop: 10, fontSize: 12,
            padding: '6px 8px', background: '#2d1b1b', borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

// ─── Helpers ───

const StatusRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: '#999' }}>{label}</span>
    <span>{value}</span>
  </div>
);

const btnStyle: React.CSSProperties = {
  padding: '5px 14px',
  fontSize: 12,
  cursor: 'pointer',
  border: '1px solid #555',
  borderRadius: 4,
  background: '#2d2d2d',
  color: '#ccc',
  transition: 'background 0.15s',
};
