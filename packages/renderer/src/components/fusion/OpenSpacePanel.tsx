import React, { useEffect } from 'react';
import { useOpenSpaceStore } from '../../stores/openspace-store';

const stateColors: Record<string, string> = {
  running: 'bg-green-500',
  starting: 'bg-yellow-400 animate-pulse',
  stopping: 'bg-yellow-400 animate-pulse',
  stopped: 'bg-gray-500',
  error: 'bg-red-500',
};

const stateLabels: Record<string, string> = {
  running: '运行中',
  starting: '启动中...',
  stopping: '停止中...',
  stopped: '已停止',
  error: '错误',
};

const healthColors: Record<string, string> = {
  healthy: 'text-green-400',
  degraded: 'text-yellow-400',
  unhealthy: 'text-red-400',
  stopped: 'text-gray-500',
};

export function OpenSpacePanel() {
  const {
    runState, health, installation, bridgeConnected, degraded,
    activeProfileId, profiles, windowMode,
    startOpenSpace, stopOpenSpace, detectInstallation,
    setWindowMode, setInstallGuideVisible,
  } = useOpenSpaceStore();

  useEffect(() => {
    detectInstallation();
  }, []);

  const healthLabel = health?.healthy ? 'healthy' : health ? (health.state === 'stopped' ? 'stopped' : 'unhealthy') : 'stopped';
  const activeProfile = profiles.find((p) => p.name === activeProfileId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-200">OpenSpace 控制</h2>
        {installation?.found === false && (
          <button
            onClick={() => setInstallGuideVisible(true)}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
          >
            安装引导
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Status indicator */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">进程状态</span>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${stateColors[runState] || 'bg-gray-500'}`} />
              <span className="text-xs font-medium text-gray-200">{stateLabels[runState] || runState}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">健康状态</span>
            <span className={`text-xs font-medium ${healthColors[healthLabel]}`}>
              {(healthLabel as string) === 'healthy' ? '✅ 健康' : (healthLabel as string) === 'degraded' ? '⚠️ 降级' : (healthLabel as string) === 'unhealthy' ? '❌ 异常' : '⚫ 未启动'}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">WebSocket</span>
            <span className={`text-xs font-medium ${bridgeConnected ? 'text-green-400' : 'text-gray-500'}`}>
              {bridgeConnected ? '已连接' : '未连接'}
            </span>
          </div>

          {installation && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">安装状态</span>
              <span className={`text-xs font-medium ${installation.found ? 'text-green-400' : 'text-yellow-400'}`}>
                {installation.found ? `v${installation.version || '?'}` : '未安装'}
              </span>
            </div>
          )}

          {degraded && (
            <div className="mt-2 rounded bg-yellow-900/30 px-2 py-1">
              <span className="text-xs text-yellow-400">⚠️ 降级模式 — OpenSpace 不可用</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {runState === 'stopped' || runState === 'error' ? (
            <button
              onClick={() => startOpenSpace()}
              disabled={(runState as string) === 'starting' || !installation?.found}
              className="flex-1 rounded bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              启动 OpenSpace
            </button>
          ) : (
            <button
              onClick={() => stopOpenSpace()}
              disabled={runState === 'stopping'}
              className="flex-1 rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              停止 OpenSpace
            </button>
          )}
        </div>

        {/* Window mode */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
          <span className="text-xs text-gray-400">窗口模式</span>
          <div className="mt-2 flex gap-1">
            {(['standalone', 'embedded', 'fullscreen'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setWindowMode(mode)}
                disabled={runState !== 'running'}
                className={`flex-1 rounded px-2 py-1 text-xs ${
                  windowMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } disabled:opacity-40`}
              >
                {mode === 'standalone' ? '独立' : mode === 'embedded' ? '嵌入' : '全屏'}
              </button>
            ))}
          </div>
        </div>

        {/* Scene summary */}
        {activeProfile && (
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
            <span className="text-xs text-gray-400">当前场景</span>
            <div className="mt-1">
              <span className="text-sm font-medium text-gray-200">{activeProfile.name}</span>
              <span className="ml-2 text-xs text-gray-500">{activeProfile.modules.length} 模块</span>
            </div>
          </div>
        )}

        {/* Not installed fallback */}
        {installation && !installation.found && (
          <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-3">
            <p className="text-xs text-yellow-400 font-medium">OpenSpace 未安装</p>
            <p className="mt-1 text-xs text-gray-400">
              请安装 OpenSpace v0.19.0+ 后使用宇宙可视化功能
            </p>
            <button
              onClick={() => setInstallGuideVisible(true)}
              className="mt-2 w-full rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
            >
              查看安装指南
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
