import React, { useState, useEffect, useCallback } from 'react';

type AdminTab = 'dashboard' | 'audit' | 'config' | 'data' | 'versions';

interface AuditEntry {
  id: number;
  action: string;
  user: string;
  details: string;
  timestamp: string;
}

interface AdminBookmark {
  id: string;
  label: string;
  username: string;
  password: string;
  createdAt: number;
  lastUsedAt?: number;
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

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboardStats();
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'versions') loadVersions();
  }, [activeTab, adminToken]);

  // Helper: call cloud API with admin token
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

  // Admin login
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
    { id: 'versions', label: '版本管理' },
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
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

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

/* ─── Bookmark helpers ─── */

const BOOKMARKS_KEY = 'admin_bookmarks';

function loadBookmarks(): AdminBookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveBookmarks(bookmarks: AdminBookmark[]) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

/** Admin login form for cloud server version management */
function AdminLoginTab({ onLogin }: { onLogin: (username: string, password: string) => Promise<boolean> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookmarks, setBookmarks] = useState<AdminBookmark[]>(() => loadBookmarks());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');

  // Reload bookmarks from localStorage on mount
  useEffect(() => {
    setBookmarks(loadBookmarks());
  }, []);

  const syncBookmarks = useCallback((next: AdminBookmark[]) => {
    setBookmarks(next);
    saveBookmarks(next);
  }, []);

  const handleSubmit = async (prefillUsername?: string, prefillPassword?: string) => {
    const u = prefillUsername ?? username;
    const p = prefillPassword ?? password;
    if (!u || !p) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    try {
      await onLogin(u, p);
      // Update lastUsedAt for the matching bookmark
      const updated = bookmarks.map(b =>
        b.username === u && b.password === p
          ? { ...b, lastUsedAt: Date.now() }
          : b
      );
      syncBookmarks(updated);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUseBookmark = async (b: AdminBookmark) => {
    setUsername(b.username);
    setPassword(b.password);
    await handleSubmit(b.username, b.password);
  };

  const handleSaveBookmark = () => {
    if (!username || !password || !bookmarkLabel.trim()) return;
    const newBm: AdminBookmark = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: bookmarkLabel.trim(),
      username,
      password,
      createdAt: Date.now(),
    };
    syncBookmarks([...bookmarks, newBm]);
    setShowSaveDialog(false);
    setBookmarkLabel('');
  };

  const handleDeleteBookmark = (id: string) => {
    syncBookmarks(bookmarks.filter(b => b.id !== id));
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-sm">
        <h3 className="text-sm text-gray-200 font-medium mb-4 text-center">云端管理登录</h3>

        {/* Quick access bookmarks */}
        {bookmarks.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-gray-500 mb-2">快捷登录</div>
            <div className="space-y-1">
              {bookmarks.map(b => (
                <div key={b.id} className="flex items-center gap-1">
                  <button
                    onClick={() => handleUseBookmark(b)}
                    disabled={loading}
                    className="flex-1 text-left text-[11px] px-2.5 py-1.5 rounded bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-600/50 disabled:opacity-50 truncate"
                    title={`${b.username} · ${b.label}`}
                  >
                    <span className="font-medium">{b.label}</span>
                    {b.lastUsedAt && (
                      <span className="text-[9px] text-gray-600 ml-2">
                        {new Date(b.lastUsedAt).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteBookmark(b.id)}
                    className="text-[9px] px-1.5 py-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                    title="删除快捷方式"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-700/50 my-3" />
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="管理员用户名"
            disabled={loading}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="密码"
            disabled={loading}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <button
            onClick={() => handleSubmit()}
            disabled={loading}
            className="w-full text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录管理后台'}
          </button>

          {/* Save as bookmark button */}
          {username && password && (
            <div className="pt-1">
              {!showSaveDialog ? (
                <button
                  onClick={() => { setBookmarkLabel(username); setShowSaveDialog(true); }}
                  className="w-full text-[10px] px-3 py-1.5 rounded text-gray-500 hover:text-gray-300 border border-dashed border-gray-600/50 hover:border-gray-500"
                >
                  + 保存为快捷方式
                </button>
              ) : (
                <div className="space-y-2 p-2 bg-gray-900/50 rounded border border-gray-700/50">
                  <input
                    type="text"
                    value={bookmarkLabel}
                    onChange={e => setBookmarkLabel(e.target.value)}
                    placeholder="快捷方式名称（如：生产环境）"
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-[10px] text-gray-200 outline-none focus:border-blue-500"
                    onKeyDown={e => e.key === 'Enter' && handleSaveBookmark()}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleSaveBookmark}
                      disabled={!bookmarkLabel.trim()}
                      className="flex-1 text-[10px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setShowSaveDialog(false)}
                      className="text-[10px] px-2 py-1 rounded text-gray-500 hover:text-gray-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionTab({
  versions,
  onCreate,
  onSubmitReview,
  onPublish,
  onRefresh,
  onLogout,
}: {
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
    try {
      await onCreate(newVersion.trim(), newChangelog.trim());
      setNewVersion('');
      setNewChangelog('');
    } finally {
      setCreating(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Admin header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500">已登录云端管理后台</span>
        <button onClick={onLogout} className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30">
          退出登录
        </button>
      </div>
      {/* Create Version Form */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-xs text-gray-200 font-medium mb-3">创建新版本</h3>
        <div className="space-y-2">
          <input
            type="text"
            value={newVersion}
            onChange={e => setNewVersion(e.target.value)}
            placeholder="版本号 (如 1.45.0)"
            disabled={creating}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <textarea
            value={newChangelog}
            onChange={e => setNewChangelog(e.target.value)}
            placeholder="更新日志"
            disabled={creating}
            rows={2}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newVersion.trim()}
            className="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建为草稿'}
          </button>
        </div>
      </div>

      {/* Version List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
          <h3 className="text-xs text-gray-200 font-medium">
            版本列表 ({versions.length})
          </h3>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50"
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
        <div className="divide-y divide-gray-700">
          {versions.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-8">暂无版本</div>
          ) : (
            versions.map(v => (
              <div key={v.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm text-gray-200 font-medium">v{v.version}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  {v.changelog && (
                    <p className="text-[10px] text-gray-500 truncate">{v.changelog}</p>
                  )}
                  {v.releaseDate && (
                    <p className="text-[9px] text-gray-600 mt-0.5">
                      {new Date(v.releaseDate).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {v.status === 'draft' && (
                    <button
                      onClick={() => onSubmitReview(v.version)}
                      className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                    >
                      提交审核
                    </button>
                  )}
                  {v.status === 'pending_review' && (
                    <button
                      onClick={() => onPublish(v.version)}
                      className="text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    >
                      发布
                    </button>
                  )}
                  {v.status === 'published' && (
                    <span className="text-[10px] text-gray-600">已发布</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
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
