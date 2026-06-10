import React from 'react';
import type { UpdateState } from '../../hooks/useAutoUpdate';
import { Button } from '../ui';

interface Props {
  update: UpdateState;
  onDownload: () => void;
  onInstall: () => void;
  onDismiss: () => void;
  onDismissSuppress?: () => void;
}

export function UpdateNotification({ update, onDownload, onInstall, onDismiss, onDismissSuppress }: Props) {
  if (update.phase === 'idle') return null;

  if (update.forceUpgrade && update.phase !== 'downloaded') {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-error-dark/10 border border-error-dark/30 text-error-dark rounded-xl p-4 max-w-sm shadow-2xl backdrop-blur-lg animate-in slide-in-bottom">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-error-dark shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">强制升级</p>
            <p className="text-xs mt-1 opacity-80">
              {update.forceUpgrade.message || `需要升级到 v${update.forceUpgrade.version}`}
            </p>
            <div className="mt-3">
              <Button variant="danger" size="sm" onClick={onDownload}>立即升级</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const phaseConfig = {
    checking: { label: '检查更新中...', color: 'primary-500', icon: 'spin' },
    available: { label: '发现新版本', color: 'primary-500', icon: 'sparkle' },
    downloading: { label: '下载中...', color: 'success-dark', icon: 'spin' },
    downloaded: { label: '下载完成', color: 'success-dark', icon: 'check' },
    installing: { label: '安装中...', color: 'primary-500', icon: 'spin' },
    error: { label: '更新失败', color: 'error-dark', icon: 'error' },
    updated: { label: '已更新', color: 'success-dark', icon: 'check' },
  };

  const config = phaseConfig[update.phase as keyof typeof phaseConfig] || phaseConfig.checking;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 border border-neutral-700/60 rounded-xl p-4 max-w-sm shadow-2xl backdrop-blur-lg animate-in slide-in-bottom">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {config.icon === 'spin' && (
            <div className={`w-4 h-4 border-2 border-${config.color}/30 border-t-${config.color} rounded-full animate-spin`} />
          )}
          {config.icon === 'sparkle' && (
            <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-12l2.5 5L21 12l-5.5 2.5L13 20l-2.5-5.5L5 12l5.5-2.5L13 4z" />
            </svg>
          )}
          {config.icon === 'check' && (
            <svg className="w-4 h-4 text-success-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {config.icon === 'error' && (
            <svg className="w-4 h-4 text-error-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="text-xs text-neutral-100 font-medium">{config.label}</span>
        </div>
        {update.phase !== 'downloading' && update.phase !== 'installing' && (
          <button
            onClick={onDismiss}
            className="text-neutral-500 hover:text-neutral-300 text-xs p-0.5 rounded transition-colors"
            aria-label="关闭更新通知"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {update.info && (
        <p className="text-[11px] text-neutral-500 mb-2">
          v{update.info.version}
          {update.info.releaseDate && (
            <span className="ml-2">
              {new Date(update.info.releaseDate).toLocaleDateString('zh-CN')}
            </span>
          )}
        </p>
      )}

      {update.phase === 'downloading' && update.progress && (
        <div className="mb-3">
          <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-success-dark rounded-full transition-all duration-300"
              style={{ width: `${update.progress.percent}%` }}
            />
          </div>
          <p className="text-[10px] text-neutral-500 mt-1">
            {update.progress.percent}% · {(update.progress.transferred / 1024 / 1024).toFixed(1)} MB
            {update.progress.bytesPerSecond > 0 &&
              ` · ${(update.progress.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`}
          </p>
        </div>
      )}

      {update.phase === 'error' && update.error && (
        <p className="text-[11px] text-error-dark/80 mb-2">{update.error}</p>
      )}

      <div className="flex gap-2">
        {update.phase === 'available' && (
          <>
            <Button variant="primary" size="sm" fullWidth onClick={onDownload}>
              下载更新
            </Button>
            {onDismissSuppress && (
              <Button variant="ghost" size="sm" onClick={onDismissSuppress}>
                稍后提醒
              </Button>
            )}
          </>
        )}
        {update.phase === 'downloaded' && (
          <Button variant="primary" size="sm" fullWidth onClick={onInstall}>
            重启安装
          </Button>
        )}
        {update.phase === 'error' && (
          <Button variant="ghost" size="sm" fullWidth onClick={onDismiss}>
            知道了
          </Button>
        )}
      </div>

      {update.phase === 'installing' && (
        <div className="flex items-center gap-2 text-xs text-neutral-500 mt-2">
          <div className="w-3 h-3 border border-primary-500/40 border-t-primary-500 rounded-full animate-spin" />
          正在安装，应用即将重启...
        </div>
      )}

      {update.info?.releaseNotes && update.phase === 'available' && (
        <details className="mt-2">
          <summary className="text-[10px] text-neutral-600 cursor-pointer hover:text-neutral-400 transition-colors">
            更新内容
          </summary>
          <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed max-h-24 overflow-y-auto">
            {update.info.releaseNotes}
          </p>
        </details>
      )}
    </div>
  );
}
