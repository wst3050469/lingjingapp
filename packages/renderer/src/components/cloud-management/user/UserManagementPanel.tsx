import { useState } from 'react';
import { Button } from '../common/components';
import { UserInfoPanel } from './UserInfoPanel';
import { SecuritySettingsPanel } from './SecuritySettingsPanel';
import { LoginHistoryPanel } from './LoginHistoryPanel';

export function UserManagementPanel() {
  const [activeTab, setActiveTab] = useState<'info' | 'security' | 'history'>('info');

  const tabs = [
    { id: 'info' as const, label: '基本信息' },
    { id: 'security' as const, label: '安全设置' },
    { id: 'history' as const, label: '登录历史' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'info' && <UserInfoPanel />}
        {activeTab === 'security' && <SecuritySettingsPanel />}
        {activeTab === 'history' && <LoginHistoryPanel />}
      </div>
    </div>
  );
}
