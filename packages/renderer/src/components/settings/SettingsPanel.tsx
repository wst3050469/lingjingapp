import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { GeneralTab } from './tabs/GeneralTab';
import { ModelTab } from './tabs/ModelTab';
import { McpTab } from './tabs/McpTab';
import { RulesTab } from './tabs/RulesTab';
import { ToolsTab } from './tabs/ToolsTab';
import { AdvancedTab } from './tabs/AdvancedTab';
import { NextTab } from './tabs/NextTab';
import { SessionTab } from './tabs/SessionTab';
import { QuestTab } from './tabs/QuestTab';
import { MemoryTab } from './tabs/MemoryTab';
import { SkillsTab } from './tabs/SkillsTab';
import { AgentsTab } from './tabs/AgentsTab';
import { IndexingTab } from './tabs/IndexingTab';
import { IntegrationsTab } from './tabs/IntegrationsTab';
import { NetworkTab } from './tabs/NetworkTab';
import { WikiTab } from './tabs/WikiTab';
import { CloudSyncTab } from './tabs/CloudSyncTab';
import { SubscriptionTab } from './tabs/SubscriptionTab';
import { EmailTab } from './tabs/EmailTab';
import { AppControlTab } from './tabs/AppControlTab';

import { ConnectorPanel } from '../workflow/ConnectorPanel';
import { BatchTaskPanel } from '../workflow/BatchTaskPanel';
type TabId = 'general' | 'model' | 'next' | 'session' | 'quest' | 'mcp' | 'rules' | 'memory' | 'skills' | 'agents' | 'codebase' | 'integrations' | 'network' | 'wiki' | 'cloud' | 'subscription' | 'workflow' | 'advanced' | 'email' | 'appcontrol';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'general', label: '\u901A\u7528' },
  { id: 'model', label: '\u6A21\u578B' },
  { id: 'next', label: 'NEXT' },
  { id: 'session', label: '\u4F1A\u8BDD' },
  { id: 'quest', label: 'Quest \u6A21\u5F0F' },
  { id: 'mcp', label: 'MCP \u670D\u52A1' },
  { id: 'rules', label: '\u89C4\u5219' },
  { id: 'memory', label: '\u8BB0\u5FC6' },
  { id: 'skills', label: '\u6280\u80FD' },
  { id: 'agents', label: '\u667A\u80FD\u4F53' },
  { id: 'codebase', label: '\u4EE3\u7801\u5E93\u7D22\u5F15' },
  { id: 'integrations', label: '\u96C6\u6210' },
  { id: 'network', label: '\u7F51\u7EDC\u8BCA\u65AD' },
  { id: 'wiki', label: 'Repo Wiki' },
  { id: 'cloud', label: '云同步' },
  { id: 'subscription', label: '订阅' },
  { id: 'workflow', label: '工作流' },
  { id: 'advanced', label: '高级' },
  { id: 'email', label: '邮件' },
  { id: 'appcontrol', label: '应用控制' },
];

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <span className="text-2xl text-cp-text-dim/30">&#128736;</span>
      </div>
      <h3 className="text-cp-text font-medium mb-2">{label}</h3>
      <p className="text-sm text-cp-text-dim/50">\u5373\u5C06\u63A8\u51FA\uFF0C\u656C\u8BF7\u671F\u5F85</p>
    </div>
  );
}

export function SettingsPanel() {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [workspace, setWorkspace] = useState('');
  const [mcpServers, setMcpServers] = useState<Array<{ name: string; tools: Array<{ name: string; description?: string }> }>>([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [version, setVersion] = useState('');

  useEffect(() => {
    loadAll();
    window.electronAPI.app.getVersion().then(setVersion);

    // 监听来自 TopBar 等组件的 Tab 切换事件
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (tab && TABS.some((t) => t.id === tab)) {
        setActiveTab(tab as TabId);
      }
    };
    window.addEventListener('settings:switch-tab', handler);
    return () => window.removeEventListener('settings:switch-tab', handler);
  }, []);

  const loadAll = () => {
    window.electronAPI.config.get().then((c: any) => setConfig(c || {}));
    window.electronAPI.config.getWorkspace().then((ws) => setWorkspace(ws || ''));
    window.electronAPI.mcp.listServers().then(setMcpServers);
  };

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2500);
  };

  const saveKey = async (key: string, value: unknown) => {
    setSaving(key);
    try {
      await window.electronAPI.config.set(key, value);
      const c = await window.electronAPI.config.get();
      setConfig(c as any);
      showStatus('\u5DF2\u4FDD\u5B58');
    } catch (err: any) {
      showStatus(`\u9519\u8BEF: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.fs.selectFolder();
    if (path) {
      setWorkspace(path);
      await window.electronAPI.config.setWorkspace(path);
      showStatus('\u5DE5\u4F5C\u533A\u5DF2\u66F4\u65B0');
    }
  };

  const refreshMcpServers = async () => {
    const servers = await window.electronAPI.mcp.listServers();
    setMcpServers(servers);
  };

  const handleConfigReset = () => {
    loadAll();
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralTab
            config={config}
            saveKey={saveKey}
            user={user}
            logout={logout}
            workspace={workspace}
            handleSelectFolder={handleSelectFolder}
          />
        );
      case 'model':
        return (
          <ModelTab
            config={config}
            saveKey={saveKey}
            saving={saving}
            setConfig={setConfig}
          />
        );
      case 'next':
        return (
          <NextTab
            config={config}
            saveKey={saveKey}
          />
        );
      case 'session':
        return (
          <SessionTab
            config={config}
            saveKey={saveKey}
          />
        );
      case 'quest':
        return (
          <QuestTab
            config={config}
            saveKey={saveKey}
          />
        );
      case 'mcp':
        return (
          <McpTab
            mcpServers={mcpServers}
            onServersChange={refreshMcpServers}
            showStatus={showStatus}
          />
        );
      case 'rules':
        return <RulesTab config={config} saveKey={saveKey} />;
      case 'memory':
        return <MemoryTab config={config} saveKey={saveKey} />;
      case 'skills':
        return <SkillsTab config={config} saveKey={saveKey} />;
      case 'agents':
        return <AgentsTab config={config} saveKey={saveKey} />;
      case 'codebase':
        return <IndexingTab config={config} saveKey={saveKey} />;
      case 'integrations':
        return <IntegrationsTab config={config} saveKey={saveKey} />;
      case 'network':
        return <NetworkTab />;
      case 'wiki':
        return <WikiTab config={config} saveKey={saveKey} />;
      case 'cloud':
        return <CloudSyncTab />;
      case 'subscription':
        return <SubscriptionTab />;
      case 'workflow':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-cp-text">Connector配置</h3>
              <ConnectorPanel />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-cp-text">批量任务配置</h3>
              <BatchTaskPanel />
            </div>
          </div>
        );
      case 'email':
        return <EmailTab />;
      case 'appcontrol':
        return <AppControlTab />;
      case 'advanced':
        return (
          <AdvancedTab
            config={config}
            saveKey={saveKey}
            saving={saving}
            showStatus={showStatus}
            onConfigReset={handleConfigReset}
          />
        );
      default: {
        const tab = TABS.find((t) => t.id === activeTab);
        return <PlaceholderTab label={tab?.label || ''} />;
      }
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <div className="w-[180px] shrink-0 bg-cp-sidebar border-r border-cp-border flex flex-col">
        {/* User profile */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-cp-accent/30 flex items-center justify-center text-sm text-cp-accent font-medium shrink-0">
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-cp-text font-medium truncate">{user?.username}</p>
              </div>
              {user?.email && <p className="text-[10px] text-cp-text-dim/50 truncate">{user.email}</p>}
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-1 px-2 space-y-0.5 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                activeTab === tab.id
                  ? 'bg-cp-surface text-cp-text font-medium'
                  : 'text-cp-text-dim hover:bg-white/5 hover:text-cp-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab title + status */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-cp-border/30 shrink-0">
          <h3 className="text-lg text-cp-text font-semibold">
            {TABS.find((t) => t.id === activeTab)?.label}
          </h3>
          {status && (
            <span className="text-xs text-cp-accent animate-pulse">{status}</span>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
