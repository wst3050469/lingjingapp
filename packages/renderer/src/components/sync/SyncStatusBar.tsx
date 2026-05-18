import React, { useState, useEffect } from 'react';

interface SyncStatusBarProps {
  onSyncNow?: () => void;
}

interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  speed?: number;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ onSyncNow }) => {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error' | 'pending'>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.cloudSync?.subscribe('sync-complete', (data: any) => {
      setSyncStatus('synced');
      setLastSyncTime(new Date(data.timestamp));
      setProgress(null);
    });

    const unsubscribeStart = window.electronAPI?.cloudSync?.subscribe('sync-start', () => {
      setSyncStatus('syncing');
    });

    const unsubscribeError = window.electronAPI?.cloudSync?.subscribe('sync-error', () => {
      setSyncStatus('error');
      setProgress(null);
    });

    return () => {
      unsubscribe?.();
      unsubscribeStart?.();
      unsubscribeError?.();
    };
  }, []);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const progressData = await window.electronAPI?.cloudSync?.getProgress();
        if (progressData && progressData.total > 0) {
          setProgress(progressData);
        }
      } catch (err) {
        console.error('Failed to fetch sync progress:', err);
      }
    };

    if (syncStatus === 'syncing') {
      const interval = setInterval(fetchProgress, 1000);
      return () => clearInterval(interval);
    }
  }, [syncStatus]);

  const handleSyncNow = async () => {
    if (onSyncNow) {
      onSyncNow();
    } else {
      try {
        await window.electronAPI?.cloudSync?.syncNow();
      } catch (err) {
        console.error('Manual sync failed:', err);
      }
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}天前`;
  };

  const getIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'synced':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'offline':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 7.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.025M3 3l18 18" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        if (progress && progress.total > 0) {
          const percent = Math.round((progress.completed / progress.total) * 100);
          return `同步中 ${progress.completed}/${progress.total} (${percent}%)`;
        }
        return '同步中...';
      case 'synced':
        return lastSyncTime ? `已同步 ${formatTime(lastSyncTime)}` : '已同步';
      case 'offline':
        return '离线模式';
      case 'error':
        return '同步失败';
      default:
        return '待同步';
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-lg bg-cp-surface hover:bg-cp-surface-hover cursor-pointer transition-colors"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={syncStatus !== 'syncing' ? handleSyncNow : undefined}
    >
      {getIcon()}
      <span className="text-xs text-cp-text-secondary">{getStatusText()}</span>
      
      {showTooltip && syncStatus === 'offline' && (
        <div className="absolute bottom-full mb-2 px-2 py-1 bg-cp-surface border border-cp-border rounded shadow-lg text-xs text-cp-text-secondary whitespace-nowrap">
          数据将在网络恢复后自动同步
        </div>
      )}
      
      {syncStatus === 'syncing' && progress && (
        <div className="w-16 h-1 bg-gray-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${(progress.completed / progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};
