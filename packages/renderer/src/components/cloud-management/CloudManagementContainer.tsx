import { useState } from 'react';
import { Button, Card } from './common/components';
import { UserManagementPanel } from './user';
import { DeviceListPanel } from './device';
import { SubscriptionPanel } from './subscription';
import { SyncPanel } from './sync';
import { StoragePanel } from './storage';
import { ApiKeyPanel } from './api-key';

export function CloudManagementContainer() {
  const [activeTab, setActiveTab] = useState<'user' | 'device' | 'subscription' | 'sync' | 'storage' | 'apiKey'>('user');

  const tabs = [
    { id: 'user' as const, icon: '👤', label: '用户管理' },
    { id: 'device' as const, icon: '📱', label: '设备管理' },
    { id: 'subscription' as const, icon: '💎', label: '订阅管理' },
    { id: 'sync' as const, icon: '🔄', label: '数据同步' },
    { id: 'storage' as const, icon: '💾', label: '存储管理' },
    { id: 'apiKey' as const, icon: '🔑', label: 'API密钥' },
  ];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.02] backdrop-blur-sm">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Card padding={false} className="p-6">
            {activeTab === 'user' && <UserManagementPanel />}
            {activeTab === 'device' && <DeviceListPanel />}
            {activeTab === 'subscription' && <SubscriptionPanel />}
            {activeTab === 'sync' && <SyncPanel />}
            {activeTab === 'storage' && <StoragePanel />}
            {activeTab === 'apiKey' && <ApiKeyPanel />}
          </Card>
        </div>
      </div>
    </div>
  );
}
