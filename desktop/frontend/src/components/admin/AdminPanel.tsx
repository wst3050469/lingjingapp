import React, { useState, useEffect } from 'react';

type AdminTab = 'dashboard' | 'audit' | 'config' | 'data' | 'versions' | 'users' | 'mcp' | 'quest';

interface AuditEntry {
  id: number;
  action: string;
  user: string;
  details: string;
  timestamp: string;
}

interface VersionEntry {
  id: string;
  version: string;
  status: 'draft' | 'pending_review' | 'published';
  releaseDate: string;
  changelog: string;
  active?: boolean;
}

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState({ agentCalls: 0, tokenUsage: 0, activeUsers: 0, uptime: '' });
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [adminToken, setAdminToken] = useState<string>(() => localStorage.getItem('cloudAdminToken') || '');
  const [systemConfig, setSystemConfig] = useState<Record<string, any>>({});
  const [dbStatus, setDbStatus] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboardStats();
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'versions') loadVersions();
    if (activeTab === 'config') loadConfig();
  }, [activeTab, adminToken]);

  useEffect(() => {
    window.electronAPI.invoke('admin:log:stats').then((r: any) => {
      if (r?.success) setDbStatus(r.stats);
    }).catch(() => {});
  }, []);

  const cloudAdminApi = async (endpoint: string, method: string = 'GET', body?: unknown) => {
    return window.electronAPI.cloud.api({
      endpoint,
      method,
      body,
      token: adminToken || undefined,
    });
  };

  const loadDashboardStats = async () => {
    try {
      const [questResult, logResult] = await Promise.all([
        window.electronAPI.invoke('admin:quest:stats'),
        window.electronAPI.invoke('admin:log:stats'),
      ]);
      setStats({
        agentCalls: questResult?.stats?.totalTasks ?? logResult?.stats?.totalLogs ?? 0,
        tokenUsage: questResult?.stats?.totalTokens ?? 0,
        activeUsers: questResult?.stats?.activeUsers ?? 1,
        uptime: logResult?.stats?.uptime ?? 'N/A',
      });
    } catch {}
  };

  const loadAuditLogs = async () => {
    try {
      const result = await window.electronAPI.invoke('admin:log:query', { limit: 50 });
      if (result?.success && Array.isArray(result.logs)) {
        setAuditLogs(result.logs.map((log: any, idx: number) => ({
          id: log.id ?? idx,
          action: log.level || log.action || 'info',
          user: log.source || log.user || 'system',
          details: log.message || log.details || '',
          timestamp: log.timestamp || log.created_at || '',
        })));
      }
    } catch {}
  };

  const loadVersions = async () => {
    if (!adminToken) return;
    try {
      const result = await cloudAdminApi('/versions', 'GET');
      if (Array.isArray(result)) {
        setVersions(result.map((v: any, idx: number) => ({
          id: v.id || `v-${idx}`,
          version: v.version || '0.0.0',
          status: v.status || 'draft',
          releaseDate: v.releaseDate || '',
          changelog: v.changelog || '',
          active: v.active || false,
        })));
      }
    } catch {}
  };

  const loadConfig = async () => {
    try {
      const result = await window.electronAPI.invoke('admin:config:get');
      if (result?.success && result.config) {
        setSystemConfig(result.config);
      }
    } catch {}
  };

  const handleConfigUpdate = async (section: string, key: string, value: any) => {
    try {
      const result = await window.electronAPI.invoke('admin:config:update', { section, key, value });
      if (result?.success) {
        setSystemConfig(result.config || {});
      }
    } catch {}
  };

  const handleConfigReset = async () => {
    try {
      const result = await window.electronAPI.invoke('admin:config:reset');
      if (result?.success) {
        setSystemConfig(result.config || {});
      }
    } catch {}
  };

  const handleCreateVersion = async (version: string, changelog: string) => {
    try {
      await cloudAdminApi('/versions', 'POST', { version, changelog });
      await loadVersions();
    } catch (err: any) {
      alert('创建版本失败: ' + (err.message || '未知错误'));
    }
  };

  const handleSubmitReview = async (version: string) => {
    try {
      await cloudAdminApi(`/versions/${version}/submit-review`, 'POST');
      await loadVersions();
    } catch (err: any) {
      alert('提交审核失败: ' + (err.message || '未知错误'));
    }
  };

  const handlePublish = async (version: string) => {
    try {
      await cloudAdminApi(`/versions/${version}/publish`, 'POST');
      await loadVersions();
    } catch (err: any) {
      alert('发布失败: ' + (err.message || '未知错误'));
    }
  };

  const handleAdminLogin = async (username: string, password: string) => {
    try {
      const result = await window.electronAPI.cloud.api({
        endpoint: '/admin/login',
        method: 'POST',
        body: { username, password },
      });
      if (result.token) {
        setAdminToken(result.token);
        localStorage.setItem('cloudAdminToken', result.token);
        return true;
      }
      return false;
    } catch (err: any) {
      throw new Error('登录失败: ' + (err.message || '未知错误'));
    }
  };

  const handleAdminLogout = () => {
    setAdminToken('');
    localStorage.removeItem('cloudAdminToken');
    setVersions([]);
  };

  const handleDbBackup = async () => {
    try {
      const configResult = await window.electronAPI.invoke('admin:config:export');
      const logResult = await window.electronAPI.invoke('admin:log:export', {});
      const backupData = {
        config: configResult?.json || {},
        logs: logResult?.data || [],
        exportedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(backupData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lingjing-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('备份失败: ' + (err.message || '未知错误'));
    }
  };

  const handleCacheClean = async () => {
    try {
      await window.electronAPI.invoke('admin:log:clean', { olderThan: 30 });
      alert('缓存清理完成');
    } catch (err: any) {
      alert('清理失败: ' + (err.message || '未知错误'));
    }
  };

  const handleExportDiagnostics = async () => {
    try {
      const [configResult, logResult, questResult] = await Promise.all([
        window.electronAPI.invoke('admin:config:export').catch(() => ({})),
        window.electronAPI.invoke('admin:log:export', { limit: 100 }).catch(() => ({})),
        window.electronAPI.invoke('admin:quest:stats').catch(() => ({})),
      ]);
      const diagData = {
        config: configResult?.json || {},
        recentLogs: logResult?.data || [],
        questStats: questResult?.stats || {},
        systemInfo: {
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      };
      const json = JSON.stringify(diagData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lingjing-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('导出失败: ' + (err.message || '未知错误'));
    }
  };

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'dashboard', label: '仪表盘' },
    { id: 'audit', label: '审计日志' },
    { id: 'config', label: '系统配置' },
    { id: 'data', label: '数据管理' },
    { id: 'versions', label: '版本管理' },
    { id: 'users', label: '用户管理' },
    { id: 'mcp', label: 'MCP服务' },
    { id: 'quest', label: '任务管理' },
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
        {activeTab === 'dashboard' && <DashboardTab stats={stats} dbStatus={dbStatus} />}
        {activeTab === 'audit' && <AuditTab logs={auditLogs} />}
        {activeTab === 'config' && <ConfigTab config={systemConfig} onUpdate={handleConfigUpdate} onReset={handleConfigReset} />}
        {activeTab === 'data' && <DataTab onBackup={handleDbBackup} onClean={handleCacheClean} onExportDiag={handleExportDiagnostics} />}
        {activeTab === 'versions' && (
          adminToken ? (
            <VersionTab
              versions={versions}
              onCreate={handleCreateVersion}
              onSubmitReview={handleSubmitReview}
              onPublish={handlePublish}
              onRefresh={loadVersions}
              onLogout={handleAdminLogout}
            />
          ) : (
            <AdminLoginTab onLogin={handleAdminLogin} />
          )
        )}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'mcp' && <McpTab />}
        {activeTab === 'quest' && <QuestTab />}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-yellow-500/20 text-yellow-400',
    pending_review: 'bg-blue-500/20 text-blue-400',
    published: 'bg-green-500/20 text-green-400',
  };
  const labels: Record<string, string> = {
    draft: '草稿',
    pending_review: '待审核',
    published: '已发布',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {labels[status] || status}
    </span>
  );
}

function AdminLoginTab({ onLogin }: { onLogin: (username: string, password: string) => Promise<boolean> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    try {
      await onLogin(username, password);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-sm">
        <h3 className="text-sm text-gray-200 font-medium mb-4 text-center">云端管理登录</h3>
        <div className="space-y-3">
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="管理员用户名" disabled={loading}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="密码" disabled={loading}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <button onClick={handleSubmit} disabled={loading}
            className="w-full text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
            {loading ? '登录中...' : '登录管理后台'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionTab({ versions, onCreate, onSubmitReview, onPublish, onRefresh, onLogout }: {
  versions: VersionEntry[];
  onCreate: (version: string, changelog: string) => Promise<void>;
  onSubmitReview: (version: string) => Promise<void>;
  onPublish: (version: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [newVersion, setNewVersion] = useState('');
  const [newChangelog, setNewChangelog] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!newVersion.trim()) return;
    setCreating(true);
    try { await onCreate(newVersion.trim(), newChangelog.trim()); setNewVersion(''); setNewChangelog(''); }
    finally { setCreating(false); }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try { await onRefresh(); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500">已登录云端管理后台</span>
        <button onClick={onLogout} className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30">退出登录</button>
      </div>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-xs text-gray-200 font-medium mb-3">创建新版本</h3>
        <div className="space-y-2">
          <input type="text" value={newVersion} onChange={e => setNewVersion(e.target.value)} placeholder="版本号 (如 1.45.0)" disabled={creating}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50" />
          <textarea value={newChangelog} onChange={e => setNewChangelog(e.target.value)} placeholder="更新日志" disabled={creating} rows={2}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50 resize-none" />
          <button onClick={handleCreate} disabled={creating || !newVersion.trim()}
            className="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
            {creating ? '创建中...' : '创建为草稿'}
          </button>
        </div>
      </div>
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
          <h3 className="text-xs text-gray-200 font-medium">版本列表 ({versions.length})</h3>
          <button onClick={handleRefresh} disabled={loading} className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50">
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
        <div className="divide-y divide-gray-700">
          {versions.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-8">暂无版本</div>
          ) : versions.map(v => (
            <div key={v.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm text-gray-200 font-medium">v{v.version}</span>
                  <StatusBadge status={v.status} />
                </div>
                {v.changelog && <p className="text-[10px] text-gray-500 truncate">{v.changelog}</p>}
                {v.releaseDate && <p className="text-[9px] text-gray-600 mt-0.5">{new Date(v.releaseDate).toLocaleString('zh-CN')}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {v.status === 'draft' && <button onClick={() => onSubmitReview(v.version)} className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">提交审核</button>}
                {v.status === 'pending_review' && <button onClick={() => onPublish(v.version)} className="text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30">发布</button>}
                {v.status === 'published' && <span className="text-[10px] text-gray-600">已发布</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardTab({ stats, dbStatus }: { stats: any; dbStatus: any }) {
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
          <div className="flex justify-between"><span className="text-gray-400">数据库</span><span className={dbStatus ? 'text-green-400' : 'text-gray-500'}>{dbStatus ? '正常' : '检测中...'}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">日志条数</span><span className="text-blue-400">{dbStatus?.totalLogs ?? '-'}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">错误数</span><span className={dbStatus?.errorCount ? 'text-red-400' : 'text-green-400'}>{dbStatus?.errorCount ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">磁盘占用</span><span className="text-blue-400">{dbStatus?.diskUsage ?? '-'}</span></div>
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

function ConfigTab({ config, onUpdate, onReset }: { config: Record<string, any>; onUpdate: (section: string, key: string, value: any) => Promise<void>; onReset: () => Promise<void> }) {
  const configSections = [
    { section: 'security', key: 'dangerousCommandPolicy', label: '危险命令策略', description: '控制台危险命令的默认处理方式', type: 'select', options: ['拦截并确认', '直接拦截', '允许执行'] },
    { section: 'agent', key: 'maxConcurrent', label: '最大并发Agent数', description: '同时运行的最大Agent数量', type: 'number', min: 1, max: 20 },
    { section: 'agent', key: 'maxTokens', label: 'Token预算上限', description: '单次对话最大Token消耗 (K)', type: 'number', min: 32, max: 512 },
    { section: 'system', key: 'autoSaveInterval', label: '自动保存间隔', description: '工作项自动保存时间间隔 (秒)', type: 'number', min: 5, max: 300 },
    { section: 'log', key: 'retentionDays', label: '日志保留天数', description: '审计日志保留天数', type: 'number', min: 7, max: 365 },
  ];

  const getValue = (section: string, key: string, fallback: any) => {
    return config?.[section]?.[key] ?? config?.[key] ?? fallback;
  };

  const defaults: Record<string, any> = {
    dangerousCommandPolicy: '拦截并确认',
    maxConcurrent: 5,
    maxTokens: 128,
    autoSaveInterval: 30,
    retentionDays: 90,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-gray-400 font-medium">系统配置</h3>
        <button onClick={onReset} className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30">重置默认</button>
      </div>
      <div className="space-y-2">
        {configSections.map(item => {
          const currentVal = getValue(item.section, item.key, defaults[item.key]);
          return (
            <div key={item.key} className="bg-gray-800/50 rounded px-3 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-200">{item.label}</span>
                {item.type === 'select' ? (
                  <select value={currentVal} onChange={e => onUpdate(item.section, item.key, e.target.value)}
                    className="text-xs bg-gray-900 border border-gray-600 rounded px-2 py-0.5 text-blue-400 outline-none">
                    {item.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input type="number" value={currentVal} min={item.min} max={item.max}
                    onChange={e => onUpdate(item.section, item.key, Number(e.target.value))}
                    className="text-xs bg-gray-900 border border-gray-600 rounded px-2 py-0.5 w-20 text-right text-blue-400 outline-none" />
                )}
              </div>
              <div className="text-[10px] text-gray-500">{item.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataTab({ onBackup, onClean, onExportDiag }: { onBackup: () => void; onClean: () => void; onExportDiag: () => void }) {
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
          <div className="text-gray-500 text-[10px]">清除30天前的日志、临时文件、过期会话</div>
        </button>
        <button onClick={onExportDiag} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs text-left">
          <div className="text-gray-200">导出诊断信息</div>
          <div className="text-gray-500 text-[10px]">导出系统配置、日志、错误报告用于排查问题</div>
        </button>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.electronAPI.invoke('admin:auth:list-users').then((r: any) => {
      if (r?.success) setUsers(r.users || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-xs text-gray-400 font-medium">用户管理</h3>
      {loading ? <div className="text-xs text-gray-500 text-center py-4">加载中...</div> : (
        users.length === 0 ? <div className="text-xs text-gray-600 text-center py-4">暂无用户</div> : (
          <div className="space-y-1">
            {users.map((user: any, idx: number) => (
              <div key={user.id ?? idx} className="bg-gray-800/50 rounded px-3 py-2 text-xs flex items-center justify-between">
                <div>
                  <span className="text-gray-200 font-medium">{user.username}</span>
                  {user.role && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">{user.role}</span>}
                </div>
                {user.email && <span className="text-gray-500">{user.email}</span>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function McpTab() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.electronAPI.invoke('admin:mcp:list-services').then((r: any) => {
      if (r?.success) setServices(r.services || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-xs text-gray-400 font-medium">MCP服务管理</h3>
      {loading ? <div className="text-xs text-gray-500 text-center py-4">加载中...</div> : (
        services.length === 0 ? <div className="text-xs text-gray-600 text-center py-4">暂无已安装服务</div> : (
          <div className="space-y-1">
            {services.map((svc: any, idx: number) => (
              <div key={svc.name ?? idx} className="bg-gray-800/50 rounded px-3 py-2 text-xs flex items-center justify-between">
                <div>
                  <span className="text-gray-200 font-medium">{svc.name}</span>
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">{svc.status || 'active'}</span>
                </div>
                <span className="text-gray-500">{svc.toolsCount ?? svc.tools?.length ?? 0} tools</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function QuestTab() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskStats, setTaskStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.electronAPI.invoke('admin:quest:list-tasks', { limit: 50 }),
      window.electronAPI.invoke('admin:quest:stats'),
    ]).then(([taskResult, statsResult]: any[]) => {
      if (taskResult?.success) setTasks(taskResult.tasks || []);
      if (statsResult?.success) setTaskStats(statsResult.stats);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAction = async (taskId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      await window.electronAPI.invoke(`admin:quest:${action}`, { taskId });
      const result = await window.electronAPI.invoke('admin:quest:list-tasks', { limit: 50 });
      if (result?.success) setTasks(result.tasks || []);
    } catch {}
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-gray-400 font-medium">任务管理</h3>
        {taskStats && <span className="text-[10px] text-gray-500">总计: {taskStats.totalTasks ?? 0} | 活跃: {taskStats.activeTasks ?? 0}</span>}
      </div>
      {loading ? <div className="text-xs text-gray-500 text-center py-4">加载中...</div> : (
        tasks.length === 0 ? <div className="text-xs text-gray-600 text-center py-4">暂无任务</div> : (
          <div className="space-y-1">
            {tasks.map((task: any) => (
              <div key={task.id} className="bg-gray-800/50 rounded px-3 py-2 text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-gray-200 font-medium">{task.title || task.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    task.status === 'running' ? 'bg-green-500/20 text-green-400' :
                    task.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                    task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{task.status}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {task.status === 'running' && <button onClick={() => handleAction(task.id, 'pause')} className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">暂停</button>}
                  {task.status === 'paused' && <button onClick={() => handleAction(task.id, 'resume')} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">恢复</button>}
                  {(task.status === 'running' || task.status === 'paused') && <button onClick={() => handleAction(task.id, 'cancel')} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">取消</button>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
