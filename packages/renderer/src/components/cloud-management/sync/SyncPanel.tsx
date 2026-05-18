import { useState, useEffect } from 'react';
import type { CloudSyncStatus, CloudSyncRecord } from '@lingjing/core';
import { Button, Card, LoadingSpinner, Progress, EmptyState, SectionHeader, Badge } from '../common/components';

export function SyncPanel() {
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus | null>(null);
  const [history, setHistory] = useState<CloudSyncRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [status, historyData] = await Promise.all([
        window.electronAPI.cloudManagement.sync.getStatus(),
        window.electronAPI.cloudManagement.sync.getHistory(20),
      ]);
      setSyncStatus(status);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load sync data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      await window.electronAPI.cloudManagement.sync.now();
      loadData();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="数据同步" />

      {syncStatus && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  syncStatus.status === 'syncing' ? 'bg-blue-500 animate-pulse' :
                  syncStatus.status === 'synced' ? 'bg-green-500' :
                  syncStatus.status === 'error' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`}
              />
              <Badge
                variant={
                  syncStatus.status === 'syncing' ? 'info' :
                  syncStatus.status === 'synced' ? 'success' :
                  syncStatus.status === 'error' ? 'error' :
                  'warning'
                }
              >
                {syncStatus.status === 'syncing' ? '同步中...' :
                 syncStatus.status === 'synced' ? '已同步' :
                 syncStatus.status === 'error' ? '同步失败' :
                 '存在冲突'}
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={handleSyncNow}
              disabled={syncStatus.status === 'syncing'}
              loading={syncStatus.status === 'syncing'}
            >
              立即同步
            </Button>
          </div>

          {syncStatus.progress && (
            <div className="mb-3">
              <Progress
                value={syncStatus.progress.completed}
                max={syncStatus.progress.total}
              />
              <p className="text-xs text-white/50 mt-1">
                {syncStatus.progress.completed} / {syncStatus.progress.total}
              </p>
            </div>
          )}

          <p className="text-xs text-white/50">
            最后同步: {new Date(syncStatus.lastSyncAt).toLocaleString()}
          </p>
        </Card>
      )}

      <SectionHeader title="同步历史" />

      <Card>
        {history.length === 0 ? (
          <EmptyState
            icon="📋"
            title="暂无同步记录"
            description="同步操作将在此显示"
          />
        ) : (
          <div className="space-y-2">
            {history.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      record.status === 'success' ? 'success' :
                      record.status === 'failed' ? 'error' :
                      'warning'
                    }
                  >
                    {record.status === 'success' ? '成功' :
                     record.status === 'failed' ? '失败' : '部分'}
                  </Badge>
                  <div>
                    <p className="text-sm text-cp-text">{record.dataType}</p>
                    <p className="text-xs text-white/50">{record.operation}</p>
                  </div>
                </div>
                <p className="text-xs text-white/50">
                  {new Date(record.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
