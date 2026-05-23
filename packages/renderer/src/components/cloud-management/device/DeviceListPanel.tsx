import { useState, useEffect } from 'react';
import type { Device } from '@codepilot/core';
import { Button, Card, Badge, EmptyState, LoadingSpinner, Input, SectionHeader } from '../common/components';

function SyncStatusIcon({ status }: { status: Device['syncStatus'] }) {
  const icons = {
    syncing: '🔄',
    synced: '✓',
    offline: '○',
    error: '✗',
  };

  const colors = {
    syncing: 'text-blue-400',
    synced: 'text-green-400',
    offline: 'text-white/50',
    error: 'text-red-400',
  };

  return <span className={colors[status]}>{icons[status]}</span>;
}

export function DeviceListPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authCode, setAuthCode] = useState('');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.cloudManagement.device.getAll();
      setDevices(data);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!confirm('确定要撤销该设备的授权吗?')) return;
    try {
      await window.electronAPI.cloudManagement.device.revoke(deviceId);
      loadDevices();
    } catch (error) {
      console.error('Failed to revoke device:', error);
    }
  };

  const handleGenerateAuthCode = async () => {
    try {
      const result = await window.electronAPI.cloudManagement.device.generateAuthCode();
      const codeInfo = result as any;
      alert(`授权码: ${codeInfo.code}\n有效期至: ${new Date(codeInfo.expiresAt).toLocaleString()}`);
    } catch (error) {
      console.error('Failed to generate auth code:', error);
    }
  };

  const handleAuthorize = async () => {
    if (!authCode.trim()) return;
    try {
      await window.electronAPI.cloudManagement.device.authorize(authCode);
      setShowAuthDialog(false);
      setAuthCode('');
      loadDevices();
    } catch (error) {
      console.error('Failed to authorize device:', error);
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
      <SectionHeader
        title="设备管理"
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowAuthDialog(true)}>
              添加设备
            </Button>
            <Button variant="secondary" size="sm" onClick={handleGenerateAuthCode}>
              生成授权码
            </Button>
          </div>
        }
      />

      <Card>
        {devices.length === 0 ? (
          <EmptyState
            icon="📱"
            title="暂无绑定设备"
            description="添加设备以实现跨设备同步"
          />
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0"
              >
                <div className="text-2xl">
                  {device.type === 'desktop' ? '💻' : device.type === 'mobile' ? '📱' : '📲'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-cp-text">{device.name}</p>
                    {device.isCurrentDevice && (
                      <Badge variant="info">当前设备</Badge>
                    )}
                    <Badge
                      variant={
                        device.authorizationStatus === 'authorized' ? 'success' :
                        device.authorizationStatus === 'pending' ? 'warning' :
                        'error'
                      }
                    >
                      {device.authorizationStatus === 'authorized' ? '已授权' :
                       device.authorizationStatus === 'pending' ? '待授权' : '已撤销'}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    {device.os} · 最后同步: {new Date(device.lastSyncAt).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <SyncStatusIcon status={device.syncStatus} />
                    <span className="text-xs text-white/50">
                      {device.isOnline ? '在线' : '离线'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!device.isCurrentDevice && device.authorizationStatus === 'authorized' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevoke(device.id)}
                    >
                      撤销
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAuthDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <Card className="w-96">
            <h3 className="text-lg font-medium text-cp-text mb-4">授权新设备</h3>
            <div className="space-y-3">
              <Input
                value={authCode}
                onChange={setAuthCode}
                placeholder="授权码"
              />
              <Button className="w-full" onClick={handleAuthorize}>
                授权
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowAuthDialog(false);
                  setAuthCode('');
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
