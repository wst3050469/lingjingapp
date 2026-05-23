import { useState, useEffect } from 'react';
import type { StorageStats, StorageFile } from '@codepilot/core';
import { Card, LoadingSpinner, EmptyState, SectionHeader, Progress } from '../common/components';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function StoragePanel() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, filesData] = await Promise.all([
        window.electronAPI.cloudManagement.storage.getStats(),
        window.electronAPI.cloudManagement.storage.getFiles({ limit: 20 }),
      ]);
      setStats(statsData);
      setFiles(Array.isArray(filesData) ? filesData : (filesData as any).files ?? []);
    } catch (error) {
      console.error('Failed to load storage data:', error);
    } finally {
      setLoading(false);
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
      <SectionHeader title="存储管理" />

      {stats && (
        <Card>
          <div className="mb-4">
            <div className="flex items-end gap-2 mb-3">
              <span className="text-3xl font-bold text-cp-text">{formatBytes(stats.used)}</span>
              <span className="text-sm text-white/50 mb-1">/ {formatBytes(stats.total)}</span>
            </div>
            <Progress value={stats.used} max={stats.total} />
          </div>

          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            <div>
              <p className="text-cp-text font-medium">{formatBytes(stats.breakdown.conversations)}</p>
              <p className="text-white/50">对话</p>
            </div>
            <div>
              <p className="text-cp-text font-medium">{formatBytes(stats.breakdown.files)}</p>
              <p className="text-white/50">文件</p>
            </div>
            <div>
              <p className="text-cp-text font-medium">{formatBytes(stats.breakdown.workflows)}</p>
              <p className="text-white/50">工作流</p>
            </div>
            <div>
              <p className="text-cp-text font-medium">{formatBytes(stats.breakdown.cache)}</p>
              <p className="text-white/50">缓存</p>
            </div>
            <div>
              <p className="text-cp-text font-medium">{formatBytes(stats.breakdown.other)}</p>
              <p className="text-white/50">其他</p>
            </div>
          </div>
        </Card>
      )}

      <SectionHeader title="文件列表" />

      <Card>
        {files.length === 0 ? (
          <EmptyState
            icon="📁"
            title="暂无文件"
            description="存储的文件将在此显示"
          />
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {file.category === 'conversation' ? '💬' :
                     file.category === 'workflow' ? '🔄' :
                     file.category === 'file' ? '📄' :
                     file.category === 'cache' ? '🗑' : '📁'}
                  </span>
                  <div>
                    <p className="text-sm text-cp-text">{file.name}</p>
                    <p className="text-xs text-white/50">{file.path}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cp-text">{formatBytes(file.size)}</p>
                  <p className="text-xs text-white/50">
                    {new Date(file.modifiedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
