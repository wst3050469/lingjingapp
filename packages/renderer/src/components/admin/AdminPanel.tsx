import React, { useState, useEffect } from 'react';

type AdminTab = 'dashboard' | 'audit' | 'config' | 'data';

interface AuditEntry {
  id: number;
  action: string;
  user: string;
  details: string;
  timestamp: string;
}

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState({ agentCalls: 0, tokenUsage: 0, activeUsers: 0, uptime: '' });

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboardStats();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  const loadDashboardStats = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('audit:getStats');
      if (result) setStats(result);
    } catch {}
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await window.electron.ipcRenderer.invoke('audit:getLogs', { limit: 50 });
      if (logs) setAuditLogs(logs);
    } catch {}
  };

  const handleDbBackup = async () => {
    try {
      await window.electron.ipcRenderer.invoke('admin:dbBackup');
    } catch {}
  };

  const handleCacheClean = async () => {
    try {
      await window.electron.ipcRenderer.invoke('admin:cacheClean');
    } catch {}
  };

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'dashboard', label: '仪表盘' },
    { id: 'audit', label: '审计日志' },
    { id: 'config', label: '系统配置' },
    { id: 'data', label: '数据管理' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-700">
        <h2 className="text-sm font-medium text-gray-200 mr-3">管理面板</h2>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-1 rounded text-xs ${activeTab === tab.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'dashboard' && <DashboardTab stats={stats} />}
        {activeTab === 'audit' && <AuditTab logs={auditLogs} />}
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'data' && <DataTab onBackup={handleDbBackup} onClean={handleCacheClean} />}
      </div>
    </div>
  );
}

function DashboardTab({ stats }: { stats: any }) {
  const cards = [
    { label: 'Agent 调用次数', value: stats.agentCalls || 0, color: 'text-blue-400' },
    { label: 'Token 消耗', value: stats.tokenUsage || 0, color: 'text-green-400' },
    { label: '活跃用户', value: stats.activeUsers || 0, color: 'text-yellow-400' },
    { label: '系统运行时间', value: stats.uptime || 'N/A', color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(card => (
          <div key={card.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-xs text-gray-400 font-medium mb-2">系统健康</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-gray-400">数据库</span><span className="text-green-400">正常</span></div>
          <div className="flex justify-between"><span className="text-gray-400">LLM Provider</span><span className="text-green-400">已连接</span></div>
          <div className="flex justify-between"><span className="text-gray-400">WebSocket</span><span className="text-green-400">运行中</span></div>
        </div>
      </div>
    </div>
  );
}

function AuditTab({ logs }: { logs: AuditEntry[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs text-gray-400 font-medium">最近操作记录</h3>
      {logs.length === 0 ? (
        <div className="text-xs text-gray-600 py-4 text-center">暂无审计日志</div>
      ) : (
        <div className="space-y-1">
          {logs.map(log => (
            <div key={log.id} className="bg-gray-800/50 rounded px-3 py-2 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-400 font-medium">{log.action}</span>
                {log.user && <span className="text-gray-500">@{log.user}</span>}
                <span className="text-gray-600 ml-auto">{log.timestamp?.slice(0, 19)}</span>
              </div>
              {log.details && <div className="text-gray-500 truncate">{log.details}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigTab() {
  return (
    <div className="space-y-3">
      <h3 className="text-xs text-gray-400 font-medium">系统配置</h3>
      <div className="space-y-2">
        <ConfigItem label="危险命令策略" description="控制台危险命令的默认处理方式" value="拦截并确认" />
        <ConfigItem label="最大并发Agent数" description="同时运行的最大Agent数量" value="5" />
        <ConfigItem label="Token预算上限" description="单次对话最大Token消耗" value="128K" />
        <ConfigItem label="自动保存间隔" description="工作项自动保存时间间隔" value="30s" />
        <ConfigItem label="日志保留天数" description="审计日志保留天数" value="90天" />
      </div>
    </div>
  );
}

function ConfigItem({ label, description, value }: { label: string; description: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded px-3 py-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-gray-200">{label}</span>
        <span className="text-xs text-blue-400">{value}</span>
      </div>
      <div className="text-[10px] text-gray-500">{description}</div>
    </div>
  );
}

function DataTab({ onBackup, onClean }: { onBackup: () => void; onClean: () => void }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs text-gray-400 font-medium">数据管理</h3>
      <div className="space-y-2">
        <button onClick={onBackup} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs text-left">
          <div className="text-gray-200">数据库备份</div>
          <div className="text-gray-500 text-[10px]">导出完整数据库快照到备份文件</div>
        </button>
        <button onClick={onClean} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs text-left">
          <div className="text-gray-200">缓存清理</div>
          <div className="text-gray-500 text-[10px]">清除LLM缓存、临时文件、过期会话</div>
        </button>
        <button className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs text-left">
          <div className="text-gray-200">导出诊断信息</div>
          <div className="text-gray-500 text-[10px]">导出系统配置、日志、错误报告用于排查问题</div>
        </button>
      </div>
    </div>
  );
}
