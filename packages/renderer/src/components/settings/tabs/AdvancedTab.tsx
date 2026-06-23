import { useState, useEffect } from 'react';
import { useAutoUpdate, UpdateState } from '../../../hooks/useAutoUpdate';
import { useUIStore } from '../../../stores/ui-store';

/* --- Helper components --- */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-xs font-medium text-cp-text-dim/70 uppercase tracking-wider">{title}</h4>
      <div className="flex-1 h-px bg-cp-border/20" />
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 mr-4">
        <p className="text-sm text-cp-text">{title}</p>
        {description && <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-green-500' : 'bg-white/10'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

function Divider() {
  return <div className="border-t border-cp-border/15" />;
}

function UpdateStatusBadge({ state }: { state: UpdateState }) {
  if (state.phase === 'checking') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">检查中</span>;
  }
  if (state.phase === 'downloading') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">下载中 {state.progress?.percent}%</span>;
  }
  if (state.phase === 'available') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">v{state.info?.version} 可用</span>;
  }
  if (state.phase === 'updated') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">已是最新</span>;
  }
  if (state.phase === 'downloaded') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">已就绪</span>;
  }
  if (state.phase === 'error') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">错误</span>;
  }
  return null;
}

/* --- Types --- */

interface AdvancedTabProps {
  config: Record<string, any>;
  saveKey: (key: string, value: unknown) => Promise<void>;
  saving: string | null;
  showStatus: (msg: string) => void;
  onConfigReset: () => void;
}

/* --- Main Component --- */

export function AdvancedTab({ config, saveKey, saving, showStatus, onConfigReset }: AdvancedTabProps) {
  const adv = config?.advanced || {};
  
  // 主题切换
  const { theme, toggleTheme } = useUIStore();

  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('');

  // Auto-update hook
  const update = useAutoUpdate();

  // Proxy
  const [proxy, setProxy] = useState<string>(adv.proxy ?? '');
  const [proxyEditing, setProxyEditing] = useState(false);
  const [proxyDraft, setProxyDraft] = useState('');

  // Update
  const [autoUpdate, setAutoUpdate] = useState<boolean>(adv.autoUpdate ?? true);

  // Process isolation
  const [processIsolation, setProcessIsolation] = useState<boolean>(adv.processIsolation ?? true);

  // Context window
  const [maxContextTokens, setMaxContextTokens] = useState<string>(String(config?.maxContextTokens ?? 128000));
  const [ctxDirty, setCtxDirty] = useState(false);

  // Conversation dir
  const [convDir, setConvDir] = useState<string>(config?.conversationDir || '');
  const [convDirEditing, setConvDirEditing] = useState(false);
  const [convDirDraft, setConvDirDraft] = useState('');

  // System prompt
  const [systemPrompt, setSystemPrompt] = useState(config?.systemPrompt || '');
  const [spDirty, setSpDirty] = useState(false);

  // Reset
  const [confirmReset, setConfirmReset] = useState(false);

  // Desktop Control Permission
  const [desktopControlEnabled, setDesktopControlEnabled] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalMode, setPasswordModalMode] = useState<'set' | 'verify'>('verify');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [hasDesktopControlPassword, setHasDesktopControlPassword] = useState(false);

  // System Power Control
  const [powerLoading, setPowerLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [powerError, setPowerError] = useState('');

  // Audio Output Device Switching
  const [audioDevices, setAudioDevices] = useState<Array<{ id: string; name: string; type: string; isActive: boolean }>>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState('');

  // Volume Control
  const [volume, setVolume] = useState(50);
  const [muted, setMuted] = useState(false);
  const [volumeLoading, setVolumeLoading] = useState(false);

  // Camera & Microphone Permissions
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [photoResult, setPhotoResult] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setVersion);
    window.electronAPI.app.platform().then(setPlatform);
  }, []);

  useEffect(() => {
    setSystemPrompt(config?.systemPrompt || '');
    setSpDirty(false);
    setMaxContextTokens(String(config?.maxContextTokens ?? 128000));
    setCtxDirty(false);
    setConvDir(config?.conversationDir || '');
    const a = config?.advanced || {};
    setProxy(a.proxy ?? '');
    setAutoUpdate(a.autoUpdate ?? true);
    setProcessIsolation(a.processIsolation ?? true);
    // Desktop control: check state on config load
    checkDesktopControlState();
    // Camera & Microphone: check state on config load
    checkDevicePermissions();
  }, [config]);

  // Handlers
  const handleSaveProxy = () => {
    const val = proxyDraft.trim();
    setProxy(val);
    saveKey('advanced.proxy', val);
    setProxyEditing(false);
  };

  const handleAutoUpdate = (v: boolean) => {
    setAutoUpdate(v);
    saveKey('advanced.autoUpdate', v);
  };

  const handleProcessIsolation = (v: boolean) => {
    setProcessIsolation(v);
    saveKey('advanced.processIsolation', v);
  };

  const handleSaveContextTokens = () => {
    const n = parseInt(maxContextTokens, 10);
    if (!isNaN(n) && n > 0) {
      saveKey('maxContextTokens', n);
      setCtxDirty(false);
    }
  };

  const handleSaveConvDir = () => {
    const val = convDirDraft.trim();
    setConvDir(val);
    saveKey('conversationDir', val || undefined);
    setConvDirEditing(false);
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    try {
      await window.electronAPI.config.reset();
      showStatus('配置已重置为默认值');
      onConfigReset();
    } catch (err: any) {
      showStatus(`重置失败: ${err.message}`);
    }
    setConfirmReset(false);
  };

  // Desktop Control handlers
  const checkDesktopControlState = async () => {
    try {
      const [enabled, hasPwd] = await Promise.all([
        window.electronAPI.desktopControl.isEnabled(),
        window.electronAPI.desktopControl.hasPassword(),
      ]);
      setDesktopControlEnabled(enabled);
      setHasDesktopControlPassword(hasPwd);
    } catch {
      // silently ignore
    }
  };

  // Camera & Microphone permission handlers
  const checkDevicePermissions = async () => {
    try {
      const [cam, mic] = await Promise.all([
        window.electronAPI.permissions.camera.isEnabled(),
        window.electronAPI.permissions.microphone.isEnabled(),
      ]);
      setCameraEnabled(cam);
      setMicrophoneEnabled(mic);
    } catch {
      // silently ignore
    }
  };

  const handleCameraToggle = async (v: boolean) => {
    setCameraEnabled(v);
    try {
      await window.electronAPI.permissions.camera.setEnabled(v);
      showStatus(v ? '摄像头权限已开启' : '摄像头权限已关闭');
    } catch (err: any) {
      setCameraEnabled(!v);
      showStatus(`操作失败: ${err.message}`);
    }
  };

  const handleCapturePhoto = async () => {
    setPhotoLoading(true);
    setPhotoError('');
    setPhotoResult(null);
    try {
      const result = await window.electronAPI.permissions.camera.capturePhoto();
      if (result.success && result.data) {
        setPhotoResult(result.data);
        showStatus('拍照成功');
      } else {
        setPhotoError(result.error || '拍照失败');
        showStatus(result.error || '拍照失败');
      }
    } catch (err: any) {
      setPhotoError(err.message || '拍照异常');
      showStatus(`拍照异常: ${err.message}`);
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleMicrophoneToggle = async (v: boolean) => {
    setMicrophoneEnabled(v);
    try {
      await window.electronAPI.permissions.microphone.setEnabled(v);
      showStatus(v ? '麦克风权限已开启' : '麦克风权限已关闭');
    } catch (err: any) {
      setMicrophoneEnabled(!v);
      showStatus(`操作失败: ${err.message}`);
    }
  };

  const handleDesktopControlToggle = async () => {
    const newState = !desktopControlEnabled;
    if (newState) {
      // Turning ON: check if password is set
      const hasPwd = await window.electronAPI.desktopControl.hasPassword();
      setHasDesktopControlPassword(hasPwd);
      if (!hasPwd) {
        setPasswordModalMode('set');
      } else {
        setPasswordModalMode('verify');
      }
    } else {
      // Turning OFF: verify password first
      setPasswordModalMode('verify');
    }
    setPasswordInput('');
    setPasswordConfirm('');
    setPasswordError('');
    setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async () => {
    setPasswordError('');
    if (!passwordInput || passwordInput.length < 6) {
      setPasswordError('密码至少需要6个字符');
      return;
    }
    if (passwordModalMode === 'set') {
      if (passwordInput !== passwordConfirm) {
        setPasswordError('两次输入的密码不一致');
        return;
      }
      setPasswordLoading(true);
      try {
        const result = await window.electronAPI.desktopControl.setPassword(passwordInput);
        if (result.success) {
          await window.electronAPI.desktopControl.setEnabled(true);
          setDesktopControlEnabled(true);
          setHasDesktopControlPassword(true);
          setPasswordModalOpen(false);
          showStatus('鼠标键盘操控权限已开启');
        } else {
          setPasswordError(result.error || '设置失败');
        }
      } catch (err: any) {
        setPasswordError(err.message || '设置异常');
      } finally {
        setPasswordLoading(false);
      }
    } else {
      setPasswordLoading(true);
      try {
        const result = await window.electronAPI.desktopControl.verifyPassword(passwordInput);
        if (result.success) {
          const newState = !desktopControlEnabled;
          await window.electronAPI.desktopControl.setEnabled(newState);
          setDesktopControlEnabled(newState);
          setPasswordModalOpen(false);
          showStatus(newState ? '鼠标键盘操控权限已开启' : '鼠标键盘操控权限已关闭');
        } else {
          setPasswordError(result.error || '密码错误');
          setPasswordInput('');
        }
      } catch (err: any) {
        setPasswordError(err.message || '验证异常');
        setPasswordInput('');
      } finally {
        setPasswordLoading(false);
      }
    }
  };

  // ── 系统电源控制 ──

  const handleShutdown = async () => {
    if (confirmAction !== 'shutdown') {
      setConfirmAction('shutdown');
      setPowerError('');
      return;
    }
    setPowerLoading('shutdown');
    setPowerError('');
    try {
      const result = await window.electronAPI.systemPower.shutdown();
      if (!result.success) setPowerError(result.error || '关机失败');
    } catch (err: any) {
      setPowerError(err.message || '关机失败');
    } finally {
      setPowerLoading(null);
      setConfirmAction(null);
    }
  };

  const handleRestart = async () => {
    if (confirmAction !== 'restart') {
      setConfirmAction('restart');
      setPowerError('');
      return;
    }
    setPowerLoading('restart');
    setPowerError('');
    try {
      const result = await window.electronAPI.systemPower.restart();
      if (!result.success) setPowerError(result.error || '重启失败');
    } catch (err: any) {
      setPowerError(err.message || '重启失败');
    } finally {
      setPowerLoading(null);
      setConfirmAction(null);
    }
  };

  const handleSleep = async () => {
    setPowerLoading('sleep');
    setPowerError('');
    try {
      const result = await window.electronAPI.systemPower.sleep();
      if (!result.success) setPowerError(result.error || '休眠失败');
    } catch (err: any) {
      setPowerError(err.message || '休眠失败');
    } finally {
      setPowerLoading(null);
    }
  };

  const handleLock = async () => {
    setPowerLoading('lock');
    setPowerError('');
    try {
      const result = await window.electronAPI.systemPower.lock();
      if (!result.success) setPowerError(result.error || '锁屏失败');
    } catch (err: any) {
      setPowerError(err.message || '锁屏失败');
    } finally {
      setPowerLoading(null);
    }
  };

  // ── 音频输出设备 ──

  const loadAudioDevices = async () => {
    setAudioLoading(true);
    setAudioError('');
    try {
      const result = await window.electronAPI.audio.enumerateDevices();
      if (result.success && result.data) {
        // 只显示输出设备 (扬声器)
        const outputs = result.data.filter((d: any) => d.type === 'output' || d.type === 'both');
        setAudioDevices(outputs);
      } else {
        setAudioError('无法枚举音频设备');
      }
    } catch (err: any) {
      setAudioError(err.message || '枚举失败');
    } finally {
      setAudioLoading(false);
    }
  };

  const handleSetOutputDevice = async (deviceId: string) => {
    setAudioLoading(true);
    setAudioError('');
    try {
      const result = await window.electronAPI.audio.setOutputDevice(deviceId);
      if (result.success) {
        await loadAudioDevices(); // 刷新列表
        showStatus('音频输出设备已切换');
      } else {
        setAudioError(result.error || '切换失败');
      }
    } catch (err: any) {
      setAudioError(err.message || '切换失败');
    } finally {
      setAudioLoading(false);
    }
  };

  // 首次加载音频设备
  useEffect(() => {
    loadAudioDevices();
  }, []);

  // ── 音量控制 ──

  const loadVolume = async () => {
    try {
      const result = await window.electronAPI.systemControl.volume.get();
      if (result.success && result.data) {
        setVolume(result.data.volume);
        setMuted(result.data.muted || false);
      }
    } catch { /* ignore */ }
  };

  const handleSetVolume = async (v: number) => {
    setVolume(v);
    try {
      await window.electronAPI.systemControl.volume.set(v);
      setMuted(false);
    } catch (err: any) {
      showStatus('音量设置失败: ' + (err.message || ''));
    }
  };

  const handleToggleMute = async () => {
    const newMuted = !muted;
    setMuted(newMuted);
    try {
      await window.electronAPI.systemControl.volume.mute();
    } catch (err: any) {
      setMuted(!newMuted);
      showStatus('静音切换失败: ' + (err.message || ''));
    }
  };

  useEffect(() => {
    loadVolume();
  }, []);

  return (
    <div className="space-y-8">
      {/* --- 网络代理 --- */}
      <div>
        <SectionHeader title="网络代理" />
        <Card>
          <div className="mb-3">
            <p className="text-sm text-cp-text font-medium">代理配置</p>
            <p className="text-[11px] text-cp-text-dim/50 mt-1 leading-relaxed">
              代理配置同步自编辑器的 http.proxy 设置
            </p>
          </div>

          {/* Proxy address display */}
          <div className="bg-white/[0.02] border border-cp-border/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-cp-text-dim">代理地址：</span>
                <span className={`text-xs ml-1 ${proxy ? 'text-cp-text font-mono' : 'text-cp-text-dim/40'}`}>
                  {proxy || '未设置'}
                </span>
              </div>
              {!proxyEditing && (
                <button
                  onClick={() => { setProxyDraft(proxy); setProxyEditing(true); }}
                  className="text-[10px] text-cp-accent hover:text-cp-accent/80"
                >
                  编辑
                </button>
              )}
            </div>

            {proxyEditing && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={proxyDraft}
                  onChange={(e) => setProxyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveProxy();
                    if (e.key === 'Escape') setProxyEditing(false);
                  }}
                  placeholder="http://127.0.0.1:7890"
                  className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setProxyEditing(false)}
                    className="text-[10px] text-cp-text-dim hover:text-cp-text"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveProxy}
                    className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* --- 外观 --- */}
      <div>
        <SectionHeader title="外观" />
        <Card>
          <div className="space-y-3">
            <SettingRow 
              title="主题模式" 
              description={theme === 'dark' ? '当前：夜晚模式（深色背景，白色文字）' : '当前：白天模式（浅色背景，深色文字）'}
            >
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:text-cp-text hover:bg-white/10 transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <span className="text-lg">☀️</span>
                    <span className="text-xs">切换到白天</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">🌙</span>
                    <span className="text-xs">切换到夜晚</span>
                  </>
                )}
              </button>
            </SettingRow>
          </div>
        </Card>
      </div>

      {/* --- 更新 --- */}
      <div>
        <SectionHeader title="更新" />
        <Card>
          <div className="space-y-3">
            <SettingRow title="自动更新" description="检测到新版本时自动下载，下次启动时安装">
              <Toggle checked={autoUpdate} onChange={handleAutoUpdate} />
            </SettingRow>

            <Divider />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cp-text">当前版本</p>
                <p className="text-[11px] text-cp-text-dim/50 mt-0.5 font-mono">{version || '...'}</p>
              </div>
              <div className="flex items-center gap-2">
                <UpdateStatusBadge state={update} />
                <button
                  onClick={() => { update.checkForUpdates(); window.electronAPI?.update?.setAutoDownload(autoUpdate); }}
                  disabled={update.phase === 'checking' || update.phase === 'downloading'}
                  className="text-xs px-3 py-1.5 rounded-md bg-white/[0.06] border border-cp-border/30 text-cp-text-dim hover:text-cp-text hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  {update.phase === 'checking' ? '检查中...' : '检查更新'}
                </button>
              </div>
            </div>

            {update.phase === 'available' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm text-blue-300 font-medium">发现新版本 v{update.info?.version}</p>
                {update.info?.releaseNotes && (
                  <p className="text-[11px] text-blue-200/60 mt-1 whitespace-pre-wrap">{update.info?.releaseNotes}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={update.downloadUpdate} className="text-xs px-3 py-1.5 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors">
                    立即下载
                  </button>
                </div>
              </div>
            )}

            {update.phase === 'downloading' && (
              <div className="bg-cp-bg/50 border border-cp-border/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-cp-text-dim">正在下载更新...</p>
                  <p className="text-xs text-cp-text-dim font-mono">{update.progress?.percent}%</p>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-cp-accent transition-all duration-300" style={{ width: `${update.progress?.percent}%` }} />
                </div>
              </div>
            )}

            {update.phase === 'downloaded' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-sm text-green-300 font-medium">更新已下载完成</p>
                <button onClick={update.installUpdate} className="text-xs px-3 py-1.5 rounded-md bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors mt-2">
                  立即重启安装
                </button>
              </div>
            )}

            {update.phase === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-300">更新检查失败</p>
                <p className="text-[11px] text-red-200/60 mt-1 font-mono">{update.error}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* --- 扩展进程隔离 --- */}
      <div>
        <SectionHeader title="扩展进程隔离" />
        <Card>
          <SettingRow
            title="AI 扩展独立进程运行"
            description="将 AI 编码扩展运行在独立的扩展宿主进程中，与第三方扩展隔离以提升稳定性。关闭后可减少内存占用。修改后需要重新加载窗口才能生效。"
          >
            <Toggle checked={processIsolation} onChange={handleProcessIsolation} />
          </SettingRow>
        </Card>
      </div>

      {/* --- 上下文窗口 --- */}
      <div>
        <SectionHeader title="上下文窗口" />
        <Card>
          <SettingRow
            title="最大 Token"
            description="对话历史超过此长度时会自动裁剪。较大的窗口消耗更多 Token。"
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={maxContextTokens}
                onChange={(e) => { setMaxContextTokens(e.target.value); setCtxDirty(true); }}
                className="w-[100px] bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text text-center outline-none focus:border-cp-accent"
                placeholder="128000"
              />
              {ctxDirty && (
                <button
                  onClick={handleSaveContextTokens}
                  className="text-xs px-2 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
                >
                  保存
                </button>
              )}
            </div>
          </SettingRow>
        </Card>
      </div>

      {/* --- 对话存储 --- */}
      <div>
        <SectionHeader title="对话存储" />
        <Card>
          <div className="flex items-center justify-between py-2.5">
            <div className="min-w-0 mr-4">
              <p className="text-sm text-cp-text">存储路径</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5">自定义对话记录存储位置</p>
            </div>
            {!convDirEditing && (
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-mono ${convDir ? 'text-cp-text' : 'text-cp-text-dim/40'}`}>
                  {convDir || '默认: ~/.lingjing/conversations/'}
                </span>
                <button
                  onClick={() => { setConvDirDraft(convDir); setConvDirEditing(true); }}
                  className="text-[10px] text-cp-accent hover:text-cp-accent/80"
                >
                  编辑
                </button>
              </div>
            )}
          </div>
          {convDirEditing && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={convDirDraft}
                onChange={(e) => setConvDirDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveConvDir();
                  if (e.key === 'Escape') setConvDirEditing(false);
                }}
                placeholder="~/.lingjing/conversations/"
                className="flex-1 bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text font-mono outline-none focus:border-cp-accent"
                autoFocus
              />
              <button
                onClick={() => setConvDirEditing(false)}
                className="text-[10px] text-cp-text-dim hover:text-cp-text shrink-0"
              >
                取消
              </button>
              <button
                onClick={handleSaveConvDir}
                className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors shrink-0"
              >
                保存
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* --- 系统提示词覆盖 --- */}
      <div>
        <SectionHeader title="系统提示词覆盖" />
        <Card>
          <p className="text-[11px] text-cp-text-dim/50 mb-3 leading-relaxed">
            完全替换默认系统提示词。留空则使用内置提示词。如果只想追加规则，请使用「规则」页签。
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => { setSystemPrompt(e.target.value); setSpDirty(true); }}
            rows={6}
            className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text
              outline-none focus:border-cp-accent font-mono resize-y min-h-[80px] leading-relaxed
              placeholder:text-cp-text-dim/40"
            placeholder="留空使用默认提示词..."
          />
          {spDirty && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => { saveKey('systemPrompt', systemPrompt || undefined); setSpDirty(false); }}
                className="text-xs px-3 py-1 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
              >
                保存
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* --- 重置 --- */}
      <div>
        <SectionHeader title="重置" />
        <Card className="!border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cp-text">重置所有设置</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5">
                清除所有配置（包括 API Key），恢复为默认值
              </p>
            </div>
            <button
              onClick={handleReset}
              className={`shrink-0 ml-4 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                confirmReset
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
              }`}
            >
              {confirmReset ? '确认重置？' : '重置配置'}
            </button>
          </div>
        </Card>
      </div>

      {/* --- 摄像头权限 --- */}
      <div>
        <SectionHeader title="摄像头权限" />
        <Card className="!border-amber-500/20 !bg-amber-500/[0.02]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cp-text font-medium">摄像头</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                允许灵境访问摄像头设备。关闭后所有摄像头相关功能将不可用。默认关闭。
              </p>
              {/* 测试拍照按钮 */}
              {cameraEnabled && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={handleCapturePhoto}
                    disabled={photoLoading}
                    className="text-xs px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
                  >
                    {photoLoading ? '拍照中...' : '📷 测试拍照'}
                  </button>
                  {photoError && (
                    <span className="text-[11px] text-red-400">{photoError}</span>
                  )}
                </div>
              )}
              {/* 拍照预览 */}
              {photoResult && (
                <div className="mt-2">
                  <img
                    src={photoResult}
                    alt="拍照预览"
                    className="max-w-[200px] max-h-[150px] rounded-lg border border-cp-border/30"
                  />
                </div>
              )}
            </div>
            <Toggle checked={cameraEnabled} onChange={handleCameraToggle} />
          </div>
        </Card>
      </div>

      {/* --- 麦克风权限 --- */}
      <div>
        <SectionHeader title="麦克风权限" />
        <Card className="!border-amber-500/20 !bg-amber-500/[0.02]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cp-text font-medium">麦克风</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                允许灵境使用麦克风进行语音输入。关闭后语音输入功能将被禁用。默认关闭。
              </p>
            </div>
            <Toggle checked={microphoneEnabled} onChange={handleMicrophoneToggle} />
          </div>
        </Card>
      </div>

      {/* --- 鼠标键盘操控权限 --- */}
      <div>
        <SectionHeader title="鼠标键盘操控权限" />
        <Card className="!border-red-500/20 !bg-red-500/[0.02]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cp-text font-medium">鼠标键盘绝对操控权限</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                允许 AI 直接操控鼠标和键盘，实现完整的桌面操作能力。此功能具有极高风险，开启后 AI 将能够操作任何桌面应用程序。
              </p>
            </div>
            <Toggle checked={desktopControlEnabled} onChange={handleDesktopControlToggle} />
          </div>
        </Card>
      </div>

      {/* --- 系统电源控制 --- */}
      {desktopControlEnabled && (
        <div>
          <SectionHeader title="系统电源控制" />
          <Card className="!border-orange-500/20 !bg-orange-500/[0.02]">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-cp-text font-medium">物理电源操作</p>
                <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                  远程执行关机、重启、休眠和锁屏操作。关机/重启需要二次确认防止误触。
                </p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 关机 */}
              <button
                onClick={handleShutdown}
                disabled={powerLoading !== null}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-40 ${
                  confirmAction === 'shutdown'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                }`}
              >
                {powerLoading === 'shutdown' ? '关机中...' : confirmAction === 'shutdown' ? '⚠ 确认关机' : '⏻ 关机'}
              </button>

              {/* 重启 */}
              <button
                onClick={handleRestart}
                disabled={powerLoading !== null}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-40 ${
                  confirmAction === 'restart'
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25'
                }`}
              >
                {powerLoading === 'restart' ? '重启中...' : confirmAction === 'restart' ? '⚠ 确认重启' : '↻ 重启'}
              </button>

              {/* 休眠 */}
              <button
                onClick={handleSleep}
                disabled={powerLoading !== null}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-40 ${
                  powerLoading === 'sleep'
                    ? 'bg-blue-500/30 text-blue-300'
                    : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                }`}
              >
                {powerLoading === 'sleep' ? '休眠中...' : '☾ 休眠'}
              </button>

              {/* 锁屏 */}
              <button
                onClick={handleLock}
                disabled={powerLoading !== null}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-40 ${
                  powerLoading === 'lock'
                    ? 'bg-slate-500/30 text-slate-300'
                    : 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25'
                }`}
              >
                {powerLoading === 'lock' ? '锁屏中...' : '🔒 锁屏'}
              </button>

              {/* 取消确认 */}
              {confirmAction && (
                <button
                  onClick={() => { setConfirmAction(null); setPowerError(''); }}
                  className="text-[10px] px-2 py-1 rounded text-cp-text-dim hover:text-cp-text hover:bg-white/5 transition-colors"
                >
                  取消
                </button>
              )}
            </div>

            {/* 错误提示 */}
            {powerError && (
              <div className="mt-2 flex items-center gap-1.5 text-red-400 text-[11px]">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {powerError}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- 音频输出设备 --- */}
      <div>
        <SectionHeader title="音频输出设备" />
        <Card>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cp-text font-medium">扬声器输出设备</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                选择音频输出设备。跨平台支持 Windows、macOS 和 Linux。
              </p>
            </div>
          </div>

          {audioLoading && audioDevices.length === 0 && (
            <p className="text-[11px] text-cp-text-dim/60">正在加载设备列表...</p>
          )}

          {audioError && (
            <div className="flex items-center gap-1.5 text-red-400 text-[11px] mb-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {audioError}
            </div>
          )}

          {audioDevices.length === 0 && !audioLoading && !audioError && (
            <p className="text-[11px] text-cp-text-dim/60">未检测到输出设备</p>
          )}

          {audioDevices.length > 0 && (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {audioDevices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => handleSetOutputDevice(device.id)}
                  disabled={audioLoading || device.isActive}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    device.isActive
                      ? 'bg-green-500/10 border border-green-500/20 cursor-default'
                      : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.05] hover:border-cp-border/30'
                  } ${audioLoading ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className={`w-3.5 h-3.5 shrink-0 ${device.isActive ? 'text-green-400' : 'text-cp-text-dim/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <span className={`truncate ${device.isActive ? 'text-green-400 font-medium' : 'text-cp-text-dim'}`}>
                      {device.name}
                    </span>
                  </div>
                  {device.isActive && (
                    <span className="text-[10px] text-green-400 font-medium shrink-0 ml-2">当前</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 刷新按钮 */}
          <div className="mt-3 flex items-center justify-end">
            <button
              onClick={loadAudioDevices}
              disabled={audioLoading}
              className="text-[10px] px-2 py-1 rounded text-cp-text-dim hover:text-cp-text hover:bg-white/5 transition-colors disabled:opacity-40"
            >
              {audioLoading ? '刷新中...' : '刷新设备列表'}
            </button>
          </div>
        </Card>
      </div>

      {/* --- 音量控制 --- */}
      <div>
        <SectionHeader title="音量控制" />
        <Card>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cp-text font-medium">系统音量</p>
              <p className="text-[11px] text-cp-text-dim/50 mt-0.5 leading-relaxed">
                调节系统音量。跨平台支持 Windows、macOS 和 Linux。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 静音按钮 */}
            <button
              onClick={handleToggleMute}
              disabled={volumeLoading}
              className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                muted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/[0.05] text-cp-text-dim hover:bg-white/10'
              }`}
              title={muted ? '取消静音' : '静音'}
            >
              {muted ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>

            {/* 音量滑块 */}
            <input
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : volume}
              onChange={(e) => handleSetVolume(parseInt(e.target.value))}
              className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cp-accent [&::-webkit-slider-thumb]:cursor-pointer"
            />

            {/* 音量数值 */}
            <span className={`text-xs font-mono w-9 text-right ${muted ? 'text-red-400' : 'text-cp-text-dim'}`}>
              {muted ? '--' : volume}
            </span>
          </div>
        </Card>
      </div>

      {/* --- 桌面操控密码弹窗 --- */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setPasswordModalOpen(false); }}>
          <div className="bg-cp-panel border border-cp-border rounded-xl w-[380px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-cp-border/30">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-sm text-cp-text font-semibold">
                  {passwordModalMode === 'set' ? '设置操控密码' : '验证操控密码'}
                </h3>
              </div>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="text-cp-text-dim/40 hover:text-cp-text"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-[11px] text-cp-text-dim/60 leading-relaxed">
                {passwordModalMode === 'set'
                  ? '首次开启此功能，请设置一个独立的专用密码。该密码与登录密码无关，请妥善保管。'
                  : `请输入专用密码以${desktopControlEnabled ? '关闭' : '开启'}鼠标键盘绝对操控权限。`}
              </p>

              <div>
                <label className="text-[11px] text-cp-text-dim mb-1 block">密码</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                  placeholder="输入专用密码"
                  className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent"
                  autoFocus
                />
              </div>

              {passwordModalMode === 'set' && (
                <div>
                  <label className="text-[11px] text-cp-text-dim mb-1 block">确认密码</label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => { setPasswordConfirm(e.target.value); setPasswordError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                    placeholder="再次输入密码"
                    className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent"
                  />
                </div>
              )}

              {passwordError && (
                <div className="flex items-center gap-1.5 text-red-400">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[11px]">{passwordError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-cp-border/30">
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="text-xs px-3 py-1.5 rounded-md text-cp-text-dim hover:text-cp-text hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={passwordLoading || !passwordInput}
                className="text-xs px-4 py-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {passwordLoading ? '验证中...' : passwordModalMode === 'set' ? '设置并开启' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 调试信息 --- */}
      <div>
        <SectionHeader title="调试信息" />
        <Card>
          <div className="text-xs text-cp-text-dim/60 space-y-1.5 font-mono">
            <p>版本: {version || '...'}</p>
            <p>平台: {platform || '...'}</p>
            <p>配置文件: ~/.lingjing/config.json</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
