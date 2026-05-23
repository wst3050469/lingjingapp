import { useState, useEffect } from 'react';
import type { ApiKey, ApiKeyStats } from '@codepilot/core';
import { Button, Card, Badge, LoadingSpinner, EmptyState, Input, SectionHeader, StatCard } from '../common/components';

export function ApiKeyPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [keysData, statsData] = await Promise.all([
        window.electronAPI.cloudManagement.apiKey.getAll(),
        window.electronAPI.cloudManagement.apiKey.getStats(),
      ]);
      setKeys(Array.isArray(keysData) ? keysData : (keysData as any).keys ?? []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const newKey = await window.electronAPI.cloudManagement.apiKey.create({
        name: newKeyName,
        permissions: ['read', 'write'],
      });
      alert(`API密钥已创建: ${newKey.key}\n请妥善保存,此密钥仅显示一次!`);
      setShowCreateDialog(false);
      setNewKeyName('');
      loadData();
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('确定要删除该API密钥吗?')) return;
    try {
      await window.electronAPI.cloudManagement.apiKey.delete(keyId);
      loadData();
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const handleToggleStatus = async (keyId: string) => {
    try {
      await window.electronAPI.cloudManagement.apiKey.toggleStatus(keyId);
      loadData();
    } catch (error) {
      console.error('Failed to toggle API key status:', error);
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
      <SectionHeader title="API密钥管理" />

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="总密钥数" value={stats.totalKeys} icon="🔑" />
          <StatCard label="活跃密钥" value={stats.activeKeys} icon="✓" />
          <StatCard label="总调用次数" value={stats.totalCalls} icon="📊" />
          <StatCard label="日均调用" value={stats.avgCallsPerDay} icon="📈" />
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          创建密钥
        </Button>
      </div>

      <Card>
        {keys.length === 0 ? (
          <EmptyState
            icon="🔑"
            title="暂无API密钥"
            description="创建API密钥以访问开放接口"
          />
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-start justify-between py-3 border-b border-white/5 last:border-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-cp-text">{key.name}</p>
                    <Badge
                      variant={
                        key.status === 'active' ? 'success' :
                        key.status === 'disabled' ? 'neutral' :
                        'error'
                      }
                    >
                      {key.status === 'active' ? '活跃' :
                       key.status === 'disabled' ? '已禁用' : '已过期'}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/50 font-mono mt-1">{key.maskedKey}</p>
                  <p className="text-xs text-white/50 mt-1">
                    创建于 {new Date(key.createdAt).toLocaleDateString()} ·
                    调用 {key.callCount} 次 · 错误 {key.errorCount} 次
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(key.id)}
                  >
                    {key.status === 'active' ? '禁用' : '启用'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(key.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <Card className="w-96">
            <h3 className="text-lg font-medium text-cp-text mb-4">创建API密钥</h3>
            <div className="space-y-3">
              <Input
                value={newKeyName}
                onChange={setNewKeyName}
                placeholder="密钥名称"
              />
              <Button className="w-full" onClick={handleCreate}>
                创建
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewKeyName('');
                }}
              >
                取消
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
