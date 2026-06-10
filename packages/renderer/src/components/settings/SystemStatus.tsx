// Unified status indicator: version check + auto-fix
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAutoUpdate } from '../../hooks/useAutoUpdate';

interface SystemStatusProps {
  showUpdateStatus?: boolean;
  showMemoryStatus?: boolean;
}

type FixPhase = 'idle' | 'checking' | 'fixing' | 'done' | 'error';
interface FixResult {
  phase: FixPhase;
  message: string;
  details: string[];
}

export function SystemStatus({ showUpdateStatus = true, showMemoryStatus = true }: SystemStatusProps) {
  const update = useAutoUpdate();
  const [memoryStatus, setMemoryStatus] = useState<'enabled' | 'disabled' | 'error'>('disabled');
  const [currentVersion, setCurrentVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [fixResult, setFixResult] = useState<FixResult>({ phase: 'idle', message: '', details: [] });
  const [diagResult, setDiagResult] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Listen for update events from useAutoUpdate bridge
  useEffect(() => {
    if (!window.electronAPI?.update) return;

    const unsubAvailable = window.electronAPI.update.onAvailable((info: any) => {
      if (!mountedRef.current) return;
      setLatestVersion(info.version);
    });

    return () => {
      unsubAvailable();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Get current version
    window.electronAPI?.app.getVersion().then(setCurrentVersion).catch(() => {});

    // Check memory status from config
    window.electronAPI?.config.get().then((config: any) => {
      const autoMemory = config?.autoMemory ?? false;
      setMemoryStatus(autoMemory ? 'enabled' : 'disabled');
    }).catch(() => {
      setMemoryStatus('error');
    });
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!window.electronAPI?.update) return;

    // Clear previous fix state
    setFixResult({ phase: 'idle', message: '', details: [] });

    // If already checking or downloading, don't duplicate
    if (update.phase === 'checking' || update.phase === 'downloading') return;

    // Start checking
    try {
      // Set a safety timeout: if events don't fire within 20s, show timeout
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          // Timeout fallback: treat as no-update (server might be slow)
          setFixResult({
            phase: 'error',
            message: '版本检查超时（服务器响应慢），当前版本可能已是最新',
            details: ['检查地址: https://lingjing.zhejiangjinmo.com/api/latest'],
          });
        }
      }, 20000);

      await window.electronAPI.update.check();
    } catch (err: any) {
      if (mountedRef.current) {
        setFixResult({
          phase: 'error',
          message: '检查更新失败: ' + (err.message || '未知错误'),
          details: ['请检查网络连接后重试'],
        });
      }
    } finally {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
    }
  }, [update.phase]);

  // Also watch for update phase changes (to clear timeout when events arrive)
  useEffect(() => {
    if (update.phase === 'available' || update.phase === 'updated' || update.phase === 'error') {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
    }
  }, [update.phase]);

  const getUpdateStatusText = (): string => {
    if (update.phase === 'checking') return '检查中...';
    if (update.phase === 'available') return `v${update.info?.version || latestVersion} 可用`;
    if (update.phase === 'updated') return '已是最新';
    if (update.phase === 'error') return update.error || '检查失败';
    if (update.phase === 'downloading') return `下载中 ${update.progress?.percent || 0}%`;
    if (update.phase === 'downloaded') return `v${update.info?.version} 已下载`;
    if (fixResult.phase === 'error') return fixResult.message;
    return '未启动';
  };

  const getUpdateStatusColor = (): string => {
    if (update.phase === 'checking') return 'bg-blue-400 animate-pulse';
    if (update.phase === 'available') return 'bg-amber-400';
    if (update.phase === 'updated') return 'bg-green-400';
    if (update.phase === 'error' || fixResult.phase === 'error') return 'bg-red-400';
    if (update.phase === 'downloading' || update.phase === 'downloaded') return 'bg-cyan-400';
    return 'bg-gray-400';
  };

  const getUpdateTextColor = (): string => {
    if (update.phase === 'checking') return 'text-blue-400';
    if (update.phase === 'available') return 'text-amber-400';
    if (update.phase === 'updated') return 'text-green-400';
    if (update.phase === 'error' || fixResult.phase === 'error') return 'text-red-400';
    if (update.phase === 'downloading' || update.phase === 'downloaded') return 'text-cyan-400';
    return 'text-gray-400';
  };

  // ── 一键彻底修复 ──
  const runFullFix = useCallback(async () => {
    if (!window.electronAPI) return;

    setFixResult({ phase: 'fixing', message: '正在诊断并修复...', details: [] });
    const details: string[] = [];

    // Step 1: Check Web Server status
    try {
      const wsStatus = await window.electronAPI.webServer.getStatus();
      if (wsStatus?.webServerRunning) {
        details.push('✅ Web Server: 运行中');
      } else {
        details.push('❌ Web Server: 未运行 — 尝试启动');
        // Try to enable and restart
        const cfg = await window.electronAPI.webServer.getConfig();
        if (cfg) {
          await window.electronAPI.webServer.saveConfig({
            ...cfg,
            enabled: true,
          });
          
          // Poll to confirm the web server actually starts (retry up to 10 times, 1s apart)
          let started = false;
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              const check = await window.electronAPI.webServer.getStatus();
              if (check?.webServerRunning) {
                started = true;
                break;
              }
            } catch { /* retry */ }
          }
          
          if (started) {
            details.push('  ✅ Web Server 已成功启动');
          } else {
            details.push('  ⚠️ 已发送重启指令但尚未确认（端口可能被占用，请运行深度诊断查看详情）');
          }
        }
      }
    } catch (err: any) {
      details.push('❌ Web Server 状态检查失败: ' + (err.message || '未知错误'));
    }

    // Step 2: Check FRP status (reuse last known status to avoid extra API call)
    try {
      // Fetch fresh status (includes FRP state)
      const freshStatus = await window.electronAPI.webServer.getStatus();
      if (freshStatus?.frp?.running) {
        details.push('✅ FRP 隧道: 已连接');
      } else if (freshStatus?.frp?.config?.enabled) {
        details.push('⏳ FRP 隧道: 配置已启用但未连接');
        details.push('  提示: 检查 frpc.exe 是否存在，或尝试关闭重开 FRP 开关');
        // Try to restart FRP by saving config
        const cfg = await window.electronAPI.webServer.getConfig();
        if (cfg) {
          await window.electronAPI.webServer.saveConfig({
            ...cfg,
            frpEnabled: cfg.frpEnabled,
          });
          details.push('  已发送 FRP 重启指令');
        }
      } else {
        details.push('⏸️ FRP 隧道: 未启用（可在设置中开启）');
      }
    } catch (err: any) {
      details.push('❌ FRP 状态检查失败: ' + (err.message || '未知错误'));
    }

    // Step 3: Version check
    try {
      if (window.electronAPI?.update) {
        await window.electronAPI.update.check();
        // Wait briefly for events to arrive
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (update.phase === 'available') {
          details.push(`📦 新版本可用: v${update.info?.version || ''}`);
        } else if (update.phase === 'updated') {
          details.push(`✅ 版本已是最新: v${currentVersion}`);
        } else {
          details.push(`⏳ 版本检查已触发，请查看上方的版本状态`);
        }
      }
    } catch (err: any) {
      details.push('❌ 版本检查失败: ' + (err.message || '未知错误'));
    }

    // Summary
    const errors = details.filter(d => d.startsWith('❌'));
    const ok = details.filter(d => d.startsWith('✅'));
    setFixResult({
      phase: errors.length > 0 ? 'done' : 'done',
      message: errors.length > 0
        ? `修复完成，发现 ${errors.length} 个问题`
        : `一切正常 (${ok.length}/${details.length})`,
      details,
    });
  }, [currentVersion, update.phase, update.info]);

  // ── 深度诊断 ──
  const runDiagnose = useCallback(async () => {
    if (!window.electronAPI?.webServer?.diagnose) return;
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const result = await window.electronAPI.webServer.diagnose();
      setDiagResult(result);
    } catch (err: any) {
      setDiagResult({ error: err.message || '诊断失败' });
    } finally {
      setDiagLoading(false);
    }
  }, []);

  return (
    <div className="space-y-2">
      {/* Update Status */}
      {showUpdateStatus && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-cp-border/30 rounded-lg">
          <div className={`w-2 h-2 rounded-full ${getUpdateStatusColor()}`} />
          <span className="text-xs text-cp-text-dim">版本检测:</span>
          <span className={`text-xs ${getUpdateTextColor()}`}>
            {getUpdateStatusText()}
          </span>
          {currentVersion && (
            <span className="text-[10px] text-cp-text-dim/50 font-mono ml-auto">
              当前: v{currentVersion}
            </span>
          )}
          <button
            onClick={checkForUpdates}
            disabled={update.phase === 'checking'}
            className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-cp-text-dim hover:text-cp-text transition-colors disabled:opacity-50"
            title="检查是否有新版本"
          >
            立即检查
          </button>
          <button
            onClick={runFullFix}
            disabled={fixResult.phase === 'fixing'}
            className="text-[10px] px-2 py-1 rounded bg-cp-accent/15 text-cp-accent hover:bg-cp-accent/25 transition-colors disabled:opacity-50"
            title="一键诊断并修复 Web Server、FRP、版本检测等问题"
          >
            {fixResult.phase === 'fixing' ? '修复中...' : '立即彻底修复'}
          </button>
          <button
            onClick={runDiagnose}
            disabled={diagLoading}
            className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            title="深度诊断 Web Server 启动失败原因"
          >
            {diagLoading ? '诊断中...' : '深度诊断'}
          </button>
        </div>
      )}

      {/* Fix result details */}
      {fixResult.phase !== 'idle' && fixResult.details.length > 0 && (
        <div className={`px-3 py-2 border rounded-lg text-[10px] leading-relaxed ${
          fixResult.details.some(d => d.startsWith('❌'))
            ? 'bg-red-500/5 border-red-500/20 text-red-300'
            : fixResult.details.some(d => d.startsWith('✅'))
              ? 'bg-green-500/5 border-green-500/20 text-green-300'
              : 'bg-white/[0.02] border-cp-border/30 text-cp-text-dim'
        }`}>
          <p className="font-medium mb-1">
            {fixResult.phase === 'fixing' ? '⏳ ' : fixResult.details.some(d => d.startsWith('❌')) ? '⚠️ ' : '✅ '}
            {fixResult.message}
          </p>
          {fixResult.details.map((d, i) => (
            <p key={i} className="pl-3 opacity-80">{d}</p>
          ))}
          <button
            onClick={() => setFixResult({ phase: 'idle', message: '', details: [] })}
            className="mt-1 text-[9px] text-cp-text-dim/40 hover:text-cp-text-dim transition-colors"
          >
            关闭
          </button>
        </div>
      )}

      {/* Download / Install buttons (from useAutoUpdate) */}
      {update.phase === 'available' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <span className="text-[11px] text-amber-300">
            新版本 v{update.info?.version} 可用
          </span>
          <button
            onClick={update.downloadUpdate}
            className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors ml-auto"
          >
            下载更新
          </button>
        </div>
      )}

      {update.phase === 'downloading' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: (update.progress?.percent || 0) + '%' }}
            />
          </div>
          <span className="text-[10px] text-blue-300">
            {update.progress?.percent || 0}%
          </span>
        </div>
      )}

      {update.phase === 'downloaded' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <span className="text-[11px] text-green-300">
            更新 v{update.info?.version} 已下载
          </span>
          <button
            onClick={update.installUpdate}
            className="text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors ml-auto"
          >
            重启安装
          </button>
        </div>
      )}

      {/* Diagnostics Panel */}
      {diagResult && (
        <div className="px-3 py-2 bg-gray-900/80 border border-cp-border/30 rounded-lg text-[10px] leading-relaxed max-h-64 overflow-auto">
          <p className="font-medium text-cp-text mb-1">🔍 深度诊断结果</p>
          {diagResult.error ? (
            <p className="text-red-400">诊断失败: {diagResult.error}</p>
          ) : (
            <>
              <p className="text-cp-text-dim">
                Web Server: {diagResult.webServerRunning ? '✅ 运行中' : '❌ 未运行'}
                {' | '}启动尝试: {diagResult.diagnostics.startAttempted ? '✅ 是' : '❌ 否'}
                {' | '}函数初始化: {diagResult.diagnostics.functionsInitialized ? '✅' : '❌'}
                {' | '}配置加载: {diagResult.diagnostics.configLoaded ? '✅' : '❌'}
                {' | '}端口: {diagResult.diagnostics.currentPort}
                {' | '}监听尝试: {diagResult.diagnostics.listenAttempts}
              </p>
              {diagResult.diagnostics.errors?.length > 0 && (
                <div className="mt-1">
                  <p className="text-red-400 font-medium">错误 ({diagResult.diagnostics.errors.length}):</p>
                  {diagResult.diagnostics.errors.map((e: any, i: number) => (
                    <p key={i} className="pl-3 text-red-300">
                      [{e.stage}] {e.message}
                      <span className="text-cp-text-dim/50 ml-1">{new Date(e.time).toLocaleTimeString()}</span>
                    </p>
                  ))}
                </div>
              )}
              {!diagResult.diagnostics.errors?.length && !diagResult.webServerRunning && (
                <p className="mt-1 text-amber-400">⚠️ 无启动错误记录 — startWebServer 可能未被调用</p>
              )}
              <p className="mt-1 text-cp-text-dim/60">
                配置文件: ports={diagResult.config?.port || '未知'}, enabled={String(diagResult.config?.enabled ?? '未知')}
              </p>
            </>
          )}
          <button
            onClick={() => setDiagResult(null)}
            className="mt-1 text-[9px] text-cp-text-dim/40 hover:text-cp-text-dim transition-colors"
          >
            关闭
          </button>
        </div>
      )}

      {/* Memory Status */}
      {showMemoryStatus && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-cp-border/30 rounded-lg">
          <div className={`w-2 h-2 rounded-full ${
            memoryStatus === 'enabled' ? 'bg-green-400' :
            memoryStatus === 'error' ? 'bg-red-400' :
            'bg-gray-400'
          }`} />
          <span className="text-xs text-cp-text-dim">自动记忆:</span>
          <span className={`text-xs ${
            memoryStatus === 'enabled' ? 'text-green-400' :
            memoryStatus === 'error' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {memoryStatus === 'enabled' ? '已启用' :
             memoryStatus === 'error' ? '错误' :
             '未启用'}
          </span>
          <span className="text-[10px] text-cp-text-dim/50 ml-auto">
            在设置 → 记忆中开启
          </span>
        </div>
      )}
    </div>
  );
}
