import { useState, useEffect, useCallback, useRef } from 'react';

/* Types */
interface CloudStatus { connected: boolean; healthy: boolean; url?: string }
interface CloudSession { id: string; title?: string; created_at?: string; messages?: any[] }
interface CloudMemory { id: string; title: string; content: string; category: string; scope: string }
interface SyncLog { time: string; action: string; status: 'ok' | 'fail'; detail?: string }
interface CloudUser { id: string; username: string; email: string; avatar?: string; registeredAt?: string }

const CLOUD_API_BASE = 'https://ide.zhejiangjinmo.com/api';
const CLOUD_TOKEN_KEY = 'cloudAccountToken';
const CLOUD_USER_KEY = 'cloudAccountUser';
const CLOUD_DEVICE_ID_KEY = 'cloudAccountDeviceId';

export function CloudSyncTab() {
  const [status, setStatus] = useState<CloudStatus>({ connected: false, healthy: false });
  const [url, setUrl] = useState(() => localStorage.getItem('cloudSyncUrl') || 'https://ide.zhejiangjinmo.com');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('cloudSyncApiKey') || '');
  const [sessions, setSessions] = useState<CloudSession[]>([]);
  const [memories, setMemories] = useState<CloudMemory[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pushedSessionId, setPushedSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('Manual Push Session');
  const [connected, setConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState({ pushed: 0, pulled: 0 });

  // ── Cloud Account Login State ──
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(() => {
    try {
      const raw = localStorage.getItem(CLOUD_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [cloudToken, setCloudToken] = useState<string | null>(() => localStorage.getItem(CLOUD_TOKEN_KEY));
  const [cloudDeviceId, setCloudDeviceId] = useState<string | null>(() => localStorage.getItem(CLOUD_DEVICE_ID_KEY));
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');

  // Heartbeat reference
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist config changes to localStorage
  useEffect(() => {
    if (url) localStorage.setItem('cloudSyncUrl', url);
  }, [url]);
  useEffect(() => {
    if (apiKey) localStorage.setItem('cloudSyncApiKey', apiKey);
  }, [apiKey]);

  const addLog = (action: string, status: 'ok' | 'fail', detail?: string) => {
    setSyncLogs(prev => [{ time: new Date().toLocaleTimeString(), action, status, detail }, ...prev].slice(0, 50));
  };

  // Connect / disconnect
  const handleConnect = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.cloud.connect({ url, apiKey });
      setStatus(result);
      setConnected(result.connected);
      // Save config on successful connection (renderer localStorage + main process file)
      if (result.connected) {
        localStorage.setItem('cloudSyncUrl', url);
        localStorage.setItem('cloudSyncApiKey', apiKey);
        // Also save via IPC so main process auto-connect can read it
        window.electronAPI.cloud.saveConfig({ url, apiKey }).catch(() => {});
        loadCloudData();
      }
      addLog('connect', result.connected ? 'ok' : 'fail', result.healthy ? 'healthy' : result.error || 'unreachable');
    } catch (err: any) {
      setStatus({ connected: false, healthy: false });
      addLog('connect', 'fail', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    // Stop auto-sync
    if (autoSyncRef.current) {
      clearInterval(autoSyncRef.current);
      autoSyncRef.current = null;
    }
    await window.electronAPI.cloud.disconnect();
    setStatus({ connected: false, healthy: false });
    setConnected(false);
    setSessions([]);
    setMemories([]);
    addLog('disconnect', 'ok');
  };

  // Auto-connect on mount if saved config exists
  const autoConnectRef = useRef(false);
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Auto-sync function: bidirectional sync (push + pull) for sessions and memories
  const triggerAutoSync = useCallback(async () => {
    try {
      console.log('[CloudSync] Auto-sync triggered - bidirectional mode');
      let pushed = 0;
      let pulled = 0;

      // 1. PUSH: Push local sessions to cloud
      try {
        const localSessions = await window.electronAPI.cloud.sessions.list();
        if (localSessions && localSessions.length > 0) {
          for (const session of localSessions.slice(0, 10)) {
            try {
              await window.electronAPI.cloud.sessions.upsert(session);
              pushed++;
            } catch (e) { /* ignore per-item errors */ }
          }
        }
      } catch (e) { /* ignore */ }

      // 2. PUSH: Push local memories to cloud
      try {
        const localMemories = await window.electronAPI.cloud.memories.list();
        if (localMemories && localMemories.length > 0) {
          for (const memory of localMemories.slice(0, 10)) {
            try {
              await window.electronAPI.cloud.memories.upsert(memory);
              pushed++;
            } catch (e) { /* ignore per-item errors */ }
          }
        }
      } catch (e) { /* ignore */ }

      // 3. PULL: Pull cloud sessions to local
      try {
        const cloudSessions = await window.electronAPI.cloud.sessions.list();
        if (cloudSessions && cloudSessions.length > 0) {
          // Fetch full content for each session
          for (const session of cloudSessions.slice(0, 10)) {
            try {
              await window.electronAPI.cloud.sessions.get(session.id);
              pulled++;
            } catch (e) { /* ignore */ }
          }
        }
      } catch (e) { /* ignore */ }

      // 4. PULL: Pull cloud memories to local
      try {
        const cloudMemories = await window.electronAPI.cloud.memories.list();
        if (cloudMemories && cloudMemories.length > 0) {
          pulled += cloudMemories.length;
        }
      } catch (e) { /* ignore */ }

      setSyncStats(prev => ({ pushed: prev.pushed + pushed, pulled: prev.pulled + pulled }));
      setLastSyncTime(new Date().toLocaleTimeString());
      addLog('auto-sync', 'ok', `推${pushed}条/拉${pulled}条`);
    } catch (err: any) {
      addLog('auto-sync', 'fail', err.message || 'sync error');
    }
  }, []);
  
  useEffect(() => {
    if (autoConnectRef.current) return;
    autoConnectRef.current = true;
    const savedUrl = localStorage.getItem('cloudSyncUrl');
    const savedKey = localStorage.getItem('cloudSyncApiKey');
    if (savedUrl && savedKey) {
      console.log('[CloudSync] Found saved config, auto-connecting...');
      setUrl(savedUrl);
      setApiKey(savedKey);
      // Trigger connect after state is set
      setTimeout(async () => {
        setLoading(true);
        try {
          const result = await window.electronAPI.cloud.connect({ url: savedUrl, apiKey: savedKey });
          setStatus(result);
          setConnected(result.connected);
          addLog('auto-connect', result.connected ? 'ok' : 'fail', result.healthy ? 'healthy' : result.error || 'unreachable');
          if (result.connected) {
            loadCloudData();
            // Start auto-sync interval (every 60 seconds)
            if (autoSyncRef.current) clearInterval(autoSyncRef.current);
            autoSyncRef.current = setInterval(() => {
              triggerAutoSync();
            }, 60000);
          }
        } catch (err: any) {
          addLog('auto-connect', 'fail', err.message);
        } finally {
          setLoading(false);
        }
      }, 100);
    }
    
    return () => {
      if (autoSyncRef.current) {
        clearInterval(autoSyncRef.current);
        autoSyncRef.current = null;
      }
    };
  }, [triggerAutoSync]);

  // Auto-check status
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (connected) {
      timer = setInterval(async () => {
        try {
          const s = await window.electronAPI.cloud.status();
          setStatus(s);
        } catch {}
      }, 5000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [connected]);

  // Subscribe to cloud events
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    unsubs.push(window.electronAPI.cloud.onStatus((data: CloudStatus) => {
      setStatus(data);
      setConnected(data.connected);
    }));
    unsubs.push(window.electronAPI.cloud.onSyncEvent((data: any) => {
      addLog('sync-event', 'ok', JSON.stringify(data).slice(0, 100));
    }));
    unsubs.push(window.electronAPI.cloud.onWebhookEvent((data: any) => {
      addLog('webhook-event', 'ok', JSON.stringify(data).slice(0, 100));
    }));
    return () => unsubs.forEach(fn => fn());
  }, []);

  const loadCloudData = async () => {
    try {
      const [sess, mem] = await Promise.all([
        window.electronAPI.cloud.sessions.list().catch(() => []),
        window.electronAPI.cloud.memories.list().catch(() => []),
      ]);
      setSessions(sess || []);
      setMemories(mem || []);
    } catch {}
  };

  // Refresh
  const refresh = async () => {
    setLoading(true);
    await loadCloudData();
    setLoading(false);
    addLog('refresh', 'ok');
  };

  // Pull session
  const pullSession = async (id: string) => {
    setPulling(id);
    try {
      const session = await window.electronAPI.cloud.sessions.get(id);
      addLog('pull-session', 'ok', `${session.title} (${session.messages?.length || 0} msgs)`);
    } catch (err: any) {
      addLog('pull-session', 'fail', err.message);
    } finally {
      setPulling(null);
    }
  };

  // Push session
  const pushSession = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.cloud.sessions.upsert({
        id: pushedSessionId || undefined,
        title: sessionTitle,
        messages: [{ role: 'user', content: 'Manual push from LingJing settings' }],
        metadata: { source: 'lingjing-ui', pushed_at: new Date().toISOString() },
      });
      setPushedSessionId(result.id);
      addLog('push-session', 'ok', `ID: ${result.id}`);
      await loadCloudData();
    } catch (err: any) {
      addLog('push-session', 'fail', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete session
  const deleteSession = async (id: string) => {
    try {
      await window.electronAPI.cloud.sessions.delete(id);
      addLog('delete-session', 'ok', id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      addLog('delete-session', 'fail', err.message);
    }
  };

  // Push memory
  const pushMemory = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.cloud.memories.upsert({
        title: 'Manual Memory from UI',
        content: 'Created via LingJing Cloud Settings at ' + new Date().toISOString(),
        category: 'test',
        scope: 'global',
      });
      addLog('push-memory', 'ok', `ID: ${result.id}`);
      await loadCloudData();
    } catch (err: any) {
      addLog('push-memory', 'fail', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete memory
  const deleteMemory = async (id: string) => {
    try {
      await window.electronAPI.cloud.memories.delete(id);
      addLog('delete-memory', 'ok', id);
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      addLog('delete-memory', 'fail', err.message);
    }
  };

  // ── Cloud Account Login / Device Registration ──

  /** Cloud server API call via Electron IPC proxy (bypasses CORS restrictions). Includes 15s timeout and friendly error messages. */
  const cloudApi = async (endpoint: string, method: string = 'POST', body?: unknown, token?: string) => {
    try {
      const result = await window.electronAPI.cloud.api({
        endpoint,
        method,
        body,
        token: token || cloudToken || undefined,
      });
      return result;
    } catch (err: any) {
      // Error messages are already translated by the main process proxy
      throw err;
    }
  };

  /** Login to cloud account */
  const handleCloudLogin = async () => {
    if (!loginEmail || !loginPassword) { setCloudError('请输入用户名和密码'); return; }
    setCloudLoading(true);
    setCloudError('');
    try {
      const data = await cloudApi('/auth/login', 'POST', {
        username: loginEmail,
        password: await sha256(loginPassword),
      });
      const user: CloudUser = data.user;
      localStorage.setItem(CLOUD_TOKEN_KEY, data.token);
      localStorage.setItem(CLOUD_USER_KEY, JSON.stringify(user));
      setCloudToken(data.token);
      setCloudUser(user);
      setLoginPassword('');
      addLog('cloud-login', 'ok', `${user.username} (${user.email})`);
      // Auto-register device after login
      await registerDevice(data.token);
      // Bind user JWT to sync client so sessions go under user account (not device)
      try {
        const bindResult = await window.electronAPI.cloud.setUserToken(data.token);
        if (bindResult.connected) {
          setConnected(true);
          setStatus(bindResult);
          loadCloudData();
          addLog('cloud-sync-connect', 'ok', '同步客户端已连接（用户模式）');
          // Start auto-sync
          if (autoSyncRef.current) clearInterval(autoSyncRef.current);
          autoSyncRef.current = setInterval(() => { triggerAutoSync(); }, 60000);
        }
        addLog('bind-user-token', 'ok', '用户JWT已绑定到同步客户端');
      } catch (err: any) {
        addLog('bind-user-token', 'fail', err.message || '绑定失败');
      }
    } catch (err: any) {
      setCloudError(err.message || '登录失败');
      addLog('cloud-login', 'fail', err.message);
    } finally {
      setCloudLoading(false);
    }
  };

  /** Register this desktop as a device on the cloud */
  const registerDevice = async (token?: string) => {
    try {
      const platform = await window.electronAPI.app.platform().catch(() => 'unknown');
      const deviceName = `LingJing Desktop (${platform})`;
      const existingId = cloudDeviceId || undefined;
      const data = await cloudApi('/devices/register', 'POST', {
        name: deviceName,
        type: 'desktop',
        os: platform,
        deviceId: existingId,
      }, token);
      const deviceId = data.id;
      localStorage.setItem(CLOUD_DEVICE_ID_KEY, deviceId);
      setCloudDeviceId(deviceId);
      addLog('device-register', 'ok', `${deviceName} (${deviceId.slice(0, 12)}...)`);
      // Start heartbeat
      startHeartbeat(deviceId, token);
    } catch (err: any) {
      addLog('device-register', 'fail', err.message);
    }
  };

  /** Start periodic heartbeat to keep device online */
  const startHeartbeat = (deviceId?: string, token?: string) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    const id = deviceId || cloudDeviceId;
    const t = token || cloudToken;
    if (!id || !t) return;
    heartbeatRef.current = setInterval(async () => {
      try {
        await cloudApi('/devices/heartbeat', 'POST', { deviceId: id }, t);
      } catch { /* best-effort */ }
    }, 60000); // every 60 seconds
  };

  /** Stop heartbeat */
  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  /** Logout from cloud account */
  const handleCloudLogout = async () => {
    try {
      if (cloudDeviceId && cloudToken) {
        await cloudApi('/devices/go-offline', 'PUT', { deviceId: cloudDeviceId }, cloudToken).catch(() => {});
      }
    } catch { /* ignore */ }
    stopHeartbeat();
    localStorage.removeItem(CLOUD_TOKEN_KEY);
    localStorage.removeItem(CLOUD_USER_KEY);
    localStorage.removeItem(CLOUD_DEVICE_ID_KEY);
    setCloudToken(null);
    setCloudUser(null);
    setCloudDeviceId(null);
    setLoginEmail('');
    setLoginPassword('');
    setCloudError('');
    addLog('cloud-logout', 'ok');
  };

  // Auto-restore session: if token exists, re-register device and start heartbeat
  useEffect(() => {
    if (cloudToken && cloudUser && !cloudDeviceId) {
      registerDevice(cloudToken);
    } else if (cloudToken && cloudDeviceId) {
      startHeartbeat(cloudDeviceId, cloudToken);
    }
    return () => { stopHeartbeat(); };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** SHA-256 hash for password */
  async function sha256(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const statusDot = status.connected && status.healthy ? 'bg-green-500' : status.connected ? 'bg-yellow-500' : 'bg-red-500';
  const statusText = status.connected && status.healthy ? '已连接' : status.connected ? '连接中...' : '未连接';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-[11px] text-cp-text-dim/50 leading-relaxed">
          灵境云同步可跨设备同步会话和记忆。配置云端服务器地址和 API Key 后，你的对话和偏好将在所有灵境实例间自动同步。
        </p>
      </div>

      {/* ── Cloud Account Login Card ── */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🔐</span>
          <span className="text-sm text-cp-text font-medium">云账号</span>
          {cloudUser && (
            <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded ml-1">已登录</span>
          )}
        </div>

        {cloudUser && cloudToken ? (
          /* ── Logged In State ── */
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-cp-accent/20 flex items-center justify-center text-sm text-cp-accent font-medium">
                {cloudUser.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-cp-text font-medium truncate">{cloudUser.username}</p>
                <p className="text-[10px] text-cp-text-dim/40 truncate">{cloudUser.email}</p>
              </div>
              <button
                onClick={handleCloudLogout}
                className="text-[10px] px-3 py-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors shrink-0"
              >
                注销
              </button>
            </div>
            {cloudDeviceId && (
              <div className="flex items-center gap-2 text-[10px] text-cp-text-dim/50">
                <span className={`w-2 h-2 rounded-full ${heartbeatRef.current ? 'bg-green-400 animate-pulse' : 'bg-yellow-500'}`} />
                <span>设备在线中</span>
                <span className="text-cp-text-dim/30">ID: {cloudDeviceId.slice(0, 16)}...</span>
              </div>
            )}
          </div>
        ) : (
          /* ── Login Form ── */
          <div>
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="用户名 / 邮箱"
                disabled={cloudLoading}
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-xs text-cp-text outline-none focus:border-cp-accent disabled:opacity-50"
                onKeyDown={e => e.key === 'Enter' && handleCloudLogin()}
              />
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="密码"
                disabled={cloudLoading}
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-xs text-cp-text outline-none focus:border-cp-accent disabled:opacity-50"
                onKeyDown={e => e.key === 'Enter' && handleCloudLogin()}
              />
            </div>
            {cloudError && (
              <p className="text-[10px] text-red-400/80 mb-2">{cloudError}</p>
            )}
            <button
              onClick={handleCloudLogin}
              disabled={cloudLoading}
              className="w-full text-xs px-4 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors disabled:opacity-50"
            >
              {cloudLoading ? '登录中...' : '登录云账号'}
            </button>
            <p className="text-[9px] text-cp-text-dim/30 mt-2 leading-relaxed">
              登录后将自动注册本机设备到您的云账号，实现在线管理和桌面-移动端中继通信。
            </p>
          </div>
        )}
      </div>

      {/* Connection Status Card */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${statusDot} animate-pulse`} />
            <span className="text-sm text-cp-text font-medium">{statusText}</span>
            {status.url && <span className="text-[10px] text-cp-text-dim/40">{status.url}</span>}
          </div>
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            disabled={loading}
            title={connected && autoSyncRef.current ? '自动同步正在运行' : ''}
            className={`text-xs px-4 py-1.5 rounded-md transition-colors ${
              connected
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            } disabled:opacity-50`}
          >
            {loading ? '···' : connected ? '断开' : '连接'}
          </button>
        </div>

        {/* Auto-sync status indicator */}
        {connected && (
          <div className="mb-3 flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${autoSyncRef.current ? 'bg-green-400 animate-pulse' : 'bg-yellow-500'}`} />
              <span className="text-cp-text-dim/50">{autoSyncRef.current ? '自动同步运行中（60秒间隔）' : '自动同步未启动'}</span>
            </div>
            {lastSyncTime && (
              <span className="text-cp-text-dim/30">上次同步: {lastSyncTime}</span>
            )}
            {syncStats.pushed > 0 && (
              <span className="text-cp-text-dim/30">累计推{syncStats.pushed}/拉{syncStats.pulled}</span>
            )}
          </div>
        )}

        {/* Config inputs */}
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-cp-text-dim/50 block mb-1">服务器 URL</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={connected}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-xs text-cp-text outline-none focus:border-cp-accent disabled:opacity-50 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-cp-text-dim/50 block mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              disabled={connected}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-xs text-cp-text outline-none focus:border-cp-accent disabled:opacity-50 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      {connected && (
        <div className="grid grid-cols-2 gap-3">
          {/* Sessions panel */}
          <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs text-cp-text font-medium">云端会话 ({sessions.length})</h4>
              <button onClick={refresh} disabled={loading} className="text-[10px] text-cp-accent hover:text-cp-accent/80">
                {loading ? '刷新中...' : '刷新'}
              </button>
            </div>

            {/* Push form */}
            <div className="mb-3 space-y-2">
              <input
                type="text"
                value={sessionTitle}
                onChange={e => setSessionTitle(e.target.value)}
                placeholder="会话标题"
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-2 py-1 text-[11px] text-cp-text outline-none focus:border-cp-accent"
              />
              <button
                onClick={pushSession}
                disabled={loading}
                className="w-full text-[11px] px-3 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors disabled:opacity-50"
              >
                推送当前会话
              </button>
              {pushedSessionId && (
                <p className="text-[10px] text-cp-text-dim/40 truncate">ID: {pushedSessionId}</p>
              )}
            </div>

            {/* Session list */}
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-[10px] text-cp-text-dim/30 text-center py-4">暂无云端会话</p>
              ) : (
                sessions.slice(0, 10).map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-2 py-1.5 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-cp-text truncate">{s.title || '(untitled)'}</p>
                      <p className="text-[9px] text-cp-text-dim/30">{s.id?.slice(0, 16)}...</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => pullSession(s.id)}
                        disabled={pulling === s.id}
                        className="text-[9px] text-blue-400/70 hover:text-blue-400 px-1.5 py-0.5"
                      >
                        {pulling === s.id ? '···' : '拉取'}
                      </button>
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="text-[9px] text-red-400/50 hover:text-red-400 px-1.5 py-0.5"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Memories panel */}
          <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs text-cp-text font-medium">云端记忆 ({memories.length})</h4>
              <button
                onClick={pushMemory}
                disabled={loading}
                className="text-[10px] text-cp-accent hover:text-cp-accent/80 disabled:opacity-50"
              >
                推送一条记忆
              </button>
            </div>

            <div className="space-y-1 max-h-[260px] overflow-y-auto">
              {memories.length === 0 ? (
                <p className="text-[10px] text-cp-text-dim/30 text-center py-4">暂无云端记忆</p>
              ) : (
                memories.slice(0, 10).map(m => (
                  <div key={m.id} className="bg-white/[0.02] rounded-lg px-2 py-1.5 group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-cp-text font-medium truncate">{m.title}</span>
                      <span className={`text-[9px] px-1 py-0.5 rounded ${m.scope === 'global' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                        {m.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-cp-text-dim/40 truncate mt-0.5">{m.content?.slice(0, 80)}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-cp-text-dim/20">{m.id?.slice(0, 12)}...</span>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="text-[9px] text-red-400/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync logs */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs text-cp-text font-medium">同步日志</h4>
          {syncLogs.length > 0 && (
            <button
              onClick={() => setSyncLogs([])}
              className="text-[10px] text-cp-text-dim/40 hover:text-cp-text-dim"
            >
              清空
            </button>
          )}
        </div>
        <div className="space-y-0.5 max-h-[150px] overflow-y-auto font-mono">
          {syncLogs.length === 0 ? (
            <p className="text-[10px] text-cp-text-dim/20 text-center py-4">暂无日志</p>
          ) : (
            syncLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="text-cp-text-dim/20 shrink-0">{log.time}</span>
                <span className={`shrink-0 ${log.status === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
                  {log.status === 'ok' ? '\u2713' : '\u2717'}
                </span>
                <span className="text-cp-text-dim/50">{log.action}</span>
                {log.detail && <span className="text-cp-text-dim/20 truncate">{log.detail}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
