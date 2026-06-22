import { useState, useEffect, useRef, useCallback } from 'react';

interface InstalledApp {
  name: string;
  path?: string;
  version?: string;
  running?: boolean;
}

interface WindowInfo {
  title: string;
  pid?: number;
  appName?: string;
}

export function AppControlTab() {
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [runningWindows, setRunningWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [launchName, setLaunchName] = useState('');
  const [launchArgs, setLaunchArgs] = useState('');
  const [desktopControlEnabled, setDesktopControlEnabled] = useState<boolean | null>(null);

  // Ref to avoid async state race on app list launch button
  const launchNameRef = useRef(launchName);
  launchNameRef.current = launchName;

  useEffect(() => {
    loadData();
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      if (window.electronAPI?.desktopControl?.isEnabled) {
        const enabled = await window.electronAPI.desktopControl.isEnabled();
        setDesktopControlEnabled(enabled);
      }
    } catch {
      setDesktopControlEnabled(false);
    }
  };

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.appControl?.getInstalledApps) {
        const result = await window.electronAPI.appControl.getInstalledApps();
        if (result?.data) {
          setInstalledApps(result.data);
        } else if (result?.error) {
          showStatus(`加载应用失败: ${result.error}`);
        }
      }
      if (window.electronAPI?.appControl?.getWindows) {
        const result = await window.electronAPI.appControl.getWindows();
        if (result?.data) {
          setRunningWindows(result.data);
        } else if (result?.error) {
          showStatus(`加载窗口失败: ${result.error}`);
        }
      }
    } catch (err: any) {
      showStatus(`加载失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Direct launch function that takes app name explicitly (avoids state race)
  const doLaunch = useCallback(async (appName: string, args?: string[]) => {
    if (!appName.trim()) {
      showStatus('请输入应用名称');
      return;
    }
    if (!desktopControlEnabled) {
      showStatus('桌面控制权限未开启，请在 设置→高级→鼠标键盘操控权限 中开启');
      return;
    }
    try {
      if (window.electronAPI?.appControl?.launchApp) {
        const result = await window.electronAPI.appControl.launchApp(appName.trim(), args);
        if (result?.success) {
          showStatus(`已启动 ${appName}`);
          setLaunchName('');
          setLaunchArgs('');
          setTimeout(() => loadData(), 1000);
        } else {
          showStatus(`启动失败: ${result?.error || '未知错误'}`);
        }
      } else {
        showStatus('启动功能不可用');
      }
    } catch (err: any) {
      showStatus(`错误: ${err.message}`);
    }
  }, [desktopControlEnabled]);

  const handleLaunch = () => {
    const args = launchArgs.trim() ? launchArgs.split(' ').filter(Boolean) : undefined;
    doLaunch(launchName, args);
  };

  const handleClose = async (appName: string) => {
    try {
      if (window.electronAPI?.appControl?.closeApp) {
        const result = await window.electronAPI.appControl.closeApp(appName);
        if (result?.success) {
          showStatus(`已关闭 ${appName}`);
          setTimeout(() => loadData(), 1000);
        } else {
          showStatus(`关闭失败: ${result?.error || '未知错误'}`);
        }
      }
    } catch (err: any) {
      showStatus(`错误: ${err.message}`);
    }
  };

  const handleFocus = async (title: string) => {
    try {
      if (window.electronAPI?.appControl?.focusWindow) {
        const result = await window.electronAPI.appControl.focusWindow(title);
        if (result?.success) {
          showStatus(`已聚焦窗口: ${title}`);
        } else {
          showStatus(`聚焦失败: ${result?.error || '未知错误'}`);
        }
      }
    } catch (err: any) {
      showStatus(`错误: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Permission status */}
      {desktopControlEnabled === false && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm text-amber-300 font-medium">桌面控制权限未开启</p>
            <p className="text-[11px] text-amber-400/60 mt-1">
              请在 设置→高级→鼠标键盘操控权限 中开启此功能
            </p>
          </div>
        </div>
      )}

      {/* 应用启动 */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-cp-text">启动应用</h3>
        <p className="text-[11px] text-cp-text-dim/60">
          输入应用名称和参数来启动应用。支持 Windows (.exe)、macOS (.app) 和 Linux 应用。
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">应用名称</label>
            <input
              type="text"
              value={launchName}
              onChange={(e) => setLaunchName(e.target.value)}
              placeholder="notepad / calc / code ..."
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
              onKeyDown={(e) => { if (e.key === 'Enter') handleLaunch(); }}
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">参数 (可选)</label>
            <input
              type="text"
              value={launchArgs}
              onChange={(e) => setLaunchArgs(e.target.value)}
              placeholder="空格分隔"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>
          <button
            onClick={handleLaunch}
            disabled={!launchName.trim() || desktopControlEnabled === false}
            className="text-xs px-4 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            启动
          </button>
        </div>
      </div>

      {/* 运行中窗口 */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-cp-text">运行中的窗口</h3>
          <button
            onClick={loadData}
            disabled={loading}
            className="text-[10px] text-cp-text-dim hover:text-cp-text px-2 py-1 rounded hover:bg-white/5 transition-colors"
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>

        {runningWindows.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-center">
            <p className="text-sm text-cp-text-dim/40">暂无运行中的窗口数据</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {runningWindows.map((win, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-black/10 rounded-lg px-3 py-2 hover:bg-black/20 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-cp-text truncate">{win.title || '(无标题)'}</p>
                  <p className="text-[10px] text-cp-text-dim/50">
                    {win.appName && `${win.appName} · `}PID: {win.pid || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => handleFocus(win.title)}
                  className="text-[10px] text-cp-accent/70 hover:text-cp-accent px-2 py-1 rounded hover:bg-cp-accent/10 transition-colors whitespace-nowrap"
                >
                  聚焦
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 已安装应用列表 */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-cp-text">已安装应用</h3>

        {installedApps.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-center">
            <p className="text-sm text-cp-text-dim/40">
              {loading ? '加载中...' : '暂无已安装应用数据'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
            {installedApps.map((app, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-black/10 rounded-lg px-3 py-2 hover:bg-black/20 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs text-cp-text truncate">{app.name}</p>
                  {app.version && (
                    <p className="text-[10px] text-cp-text-dim/50">v{app.version}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => doLaunch(app.name)}
                    className="text-[10px] text-green-400/70 hover:text-green-400 px-1.5 py-0.5 rounded hover:bg-green-500/10 transition-colors"
                  >
                    启动
                  </button>
                  {app.running && (
                    <button
                      onClick={() => handleClose(app.name)}
                      className="text-[10px] text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                    >
                      关闭
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 状态提示 */}
      {status && (
        <div className={`text-xs px-4 py-2 rounded-lg ${
          status.includes('成功') || status.includes('已') ? 'bg-green-500/10 text-green-400' :
          status.includes('失败') || status.includes('错误') ? 'bg-red-500/10 text-red-400' :
          'bg-blue-500/10 text-blue-400'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}
