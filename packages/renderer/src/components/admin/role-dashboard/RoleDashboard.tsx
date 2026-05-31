import React, { useState, useEffect, useCallback } from 'react';
import type { TenantRole, UserProfile } from './types';
import { ROLE_LABELS } from './types';
import { TenantAdminDashboard } from './TenantAdminDashboard';
import { ProjectManagerDashboard } from './ProjectManagerDashboard';
import { WorkerDashboard } from './WorkerDashboard';

interface Props {
  tenantServerUrl: string;
  /** 是否来自 AdminPanel（带云管理登录上下文） */
  fromAdminPanel?: boolean;
  isLoggedIn?: boolean;
}

const ROLE_PERSIST_KEY = 'admin_role_override';
const TENANT_TOKEN_KEY = 'tenant_auth_token';
const TENANT_USER_KEY = 'tenant_auth_user';
const ALL_ROLES: { value: TenantRole; label: string; icon: string }[] = [
  { value: 'admin', label: '租户管理员', icon: '🏢' },
  { value: 'project_manager', label: '项目经理', icon: '📊' },
  { value: 'worker', label: '工人', icon: '🔧' },
  { value: 'technician', label: '技术员', icon: '🔬' },
];

/** 角色仪表盘统一入口 — 根据用户角色渲染对应的看板 */
export function RoleDashboard({ tenantServerUrl, fromAdminPanel, isLoggedIn }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualRole, setManualRole] = useState<TenantRole>(() => {
    const saved = localStorage.getItem(ROLE_PERSIST_KEY);
    if (saved === 'admin' || saved === 'project_manager' || saved === 'worker' || saved === 'technician') return saved;
    return null;
  });
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  // 租户登录状态（独立于云管理登录）
  const [tenantToken, setTenantToken] = useState<string>(() => localStorage.getItem(TENANT_TOKEN_KEY) || '');
  const [tenantUser, setTenantUser] = useState<string>(() => localStorage.getItem(TENANT_USER_KEY) || '');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // 租户 API 调用（带租户 token）
  const tenantApi = useCallback(async (endpoint: string, method: string = 'GET', body?: unknown) => {
    const baseUrl = tenantServerUrl || 'https://ide.zhejiangjinmo.com/api';
    const url = `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\//, '')}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tenantToken) headers['Authorization'] = `Bearer ${tenantToken}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text.slice(0, 100)}`);
    }
    return res.json();
  }, [tenantServerUrl, tenantToken]);

  useEffect(() => {
    if (tenantToken) loadProfile();
  }, [tenantToken]);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await tenantApi('/api/v1/user/profile');
      if (res?.tenant_role) {
        setProfile({
          nickname: res.nickname || '',
          tenant_id: res.tenant_id || null,
          company_name: res.company_name || null,
          tenant_role: res.tenant_role as TenantRole,
          owner_name: res.owner_name || null,
          industry: res.industry || null,
          account_type: res.account_type || 'personal',
          welcome_chips: res.welcome_chips || [],
          pending_notifications: res.pending_notifications || [],
        });
        setManualRole(null);
        localStorage.removeItem(ROLE_PERSIST_KEY);
      } else if (res?.code === 0) {
        setProfile({
          nickname: res.nickname || '',
          tenant_id: null,
          company_name: null,
          tenant_role: null,
          owner_name: null,
          industry: null,
          account_type: 'personal',
          welcome_chips: [],
          pending_notifications: [],
        });
      }
    } catch (err: any) {
      console.warn('[RoleDashboard] Profile API:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 租户登录
  const handleTenantLogin = async () => {
    if (!loginUsername || !loginPassword) { setLoginError('请输入用户名和密码'); return; }
    setLoginLoading(true);
    setLoginError('');
    try {
      const baseUrl = tenantServerUrl || 'https://ide.zhejiangjinmo.com/api';
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (data.token) {
        setTenantToken(data.token);
        setTenantUser(loginUsername);
        localStorage.setItem(TENANT_TOKEN_KEY, data.token);
        localStorage.setItem(TENANT_USER_KEY, loginUsername);
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setLoginError(data.detail || '登录失败');
      }
    } catch (err: any) {
      setLoginError(err.message || '连接失败');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleTenantLogout = () => {
    setTenantToken('');
    setTenantUser('');
    setProfile(null);
    setError('');
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem(TENANT_USER_KEY);
  };

  const handleManualRoleSelect = useCallback((role: TenantRole) => {
    setManualRole(role);
    setShowRolePicker(false);
    if (role) localStorage.setItem(ROLE_PERSIST_KEY, role);
    else localStorage.removeItem(ROLE_PERSIST_KEY);
    setProfile({
      nickname: '预览用户',
      tenant_id: 'demo',
      company_name: '演示企业',
      tenant_role: role,
      owner_name: '演示管理员',
      industry: null,
      account_type: 'enterprise',
      welcome_chips: [],
      pending_notifications: [],
    });
  }, []);

  // ── 来自 AdminPanel 且未登录云管理后台 ──
  if (fromAdminPanel && !isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4 py-8 max-w-xs">
          <div className="text-3xl mb-3">🔐</div>
          <p className="text-sm text-gray-400 font-medium mb-1">请先登录云管理后台</p>
          <p className="text-[10px] text-gray-500">切换到"版本管理"标签页，使用管理员账号登录后即可查看角色仪表盘</p>
        </div>
      </div>
    );
  }

  // ── 租户登录表单 ──
  if (!tenantToken) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm">
          <h3 className="text-sm text-gray-200 font-medium mb-4 text-center">租户登录</h3>
          <div className="text-[10px] text-gray-500 mb-3 text-center">
            使用租户账号登录以查看业务仪表盘
            {tenantServerUrl && <span className="block text-[9px] text-gray-600 mt-0.5">服务器: {tenantServerUrl}</span>}
          </div>
          <div className="space-y-2.5">
            <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)}
              placeholder="用户名" disabled={loginLoading}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
              onKeyDown={e => e.key === 'Enter' && handleTenantLogin()} />
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              placeholder="密码" disabled={loginLoading}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
              onKeyDown={e => e.key === 'Enter' && handleTenantLogin()} />
            {loginError && <p className="text-[10px] text-red-400">{loginError}</p>}
            <button onClick={handleTenantLogin} disabled={loginLoading}
              className="w-full text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
              {loginLoading ? '登录中...' : '登录租户'}
            </button>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-700/50">
            <p className="text-[10px] text-gray-500 mb-2">或选择角色预览看板：</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_ROLES.map(r => (
                <button key={r.value} onClick={() => handleManualRoleSelect(r.value)}
                  className="text-left px-2.5 py-2 rounded border border-gray-600/50 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors">
                  <span className="mr-1">{r.icon}</span>{r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 加载中 ──
  if (loading) {
    return <div className="flex items-center justify-center h-40"><span className="text-xs text-gray-500">加载用户信息...</span></div>;
  }

  // ── 角色选择器（API 失败时） ──
  const rolePicker = (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-amber-500/30 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-amber-400 font-medium">⚠️ 未能自动获取角色</span>
        <button onClick={loadProfile} className="text-[9px] px-2 py-0.5 rounded bg-gray-700 text-gray-400 hover:text-gray-200 ml-auto">重试</button>
      </div>
      <p className="text-[10px] text-gray-500 mb-2">请手动选择一个角色来预览看板：</p>
      <div className="grid grid-cols-2 gap-1.5">
        {ALL_ROLES.map(r => (
          <button key={r.value} onClick={() => handleManualRoleSelect(r.value)}
            className={`text-left px-2.5 py-2 rounded border text-xs transition-colors ${manualRole === r.value ? 'border-blue-500 bg-blue-500/20 text-blue-300' : 'border-gray-600/50 bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
            <span className="mr-1">{r.icon}</span>{r.label}
          </button>
        ))}
      </div>
    </div>
  );

  const effectiveRole = profile?.tenant_role || manualRole;

  // 有 profile 但无角色
  if (profile && !effectiveRole && !error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4 py-8 max-w-xs">
          <div className="text-3xl mb-3">👤</div>
          <p className="text-sm text-gray-400 font-medium mb-1">个人用户</p>
          <p className="text-[10px] text-gray-500">当前账号未关联企业租户</p>
        </div>
      </div>
    );
  }

  // API 失败无角色
  if (!effectiveRole && error) {
    return <div className="h-full flex flex-col justify-center px-4 py-8">{rolePicker}</div>;
  }

  const role = effectiveRole!;
  const roleLabel = ROLE_LABELS[role] || role;
  const isManualMode = !profile?.tenant_role && !!manualRole;

  // 顶部角色信息栏
  const roleHeader = (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{role === 'owner' || role === 'admin' ? '🏢' : role === 'project_manager' ? '📊' : '🔧'}</span>
          <div>
            <p className="text-xs text-gray-200 font-medium">{profile?.company_name || '企业'}</p>
            <p className="text-[10px] text-gray-500">
              {profile?.nickname || '用户'} · {roleLabel}
              {isManualMode && <span className="text-amber-400 ml-1">(预览)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* 角色快捷切换 */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(v => !v)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 hover:text-gray-200"
              title="切换角色预览"
            >
              🔄
            </button>
            {showRoleMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowRoleMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]">
                  {ALL_ROLES.map(r => (
                    <button
                      key={r.value}
                      onClick={() => {
                        handleManualRoleSelect(r.value);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                        role === r.value && !isManualMode ? 'text-blue-400 bg-blue-500/10' :
                        manualRole === r.value ? 'text-amber-400 bg-amber-500/10' :
                        'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <span>{r.icon}</span>
                      <span className="flex-1">{r.label}</span>
                      {(role === r.value && !isManualMode) && <span className="text-[9px] text-gray-500">当前</span>}
                      {manualRole === r.value && <span className="text-[9px] text-amber-500">预览</span>}
                    </button>
                  ))}
                  {isManualMode && (
                    <div className="border-t border-gray-700/50 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setManualRole(null);
                          setShowRoleMenu(false);
                          localStorage.removeItem(ROLE_PERSIST_KEY);
                          if (tenantToken) loadProfile();
                        }}
                        className="w-full text-left px-3 py-1.5 text-[10px] text-gray-500 hover:text-gray-300"
                      >
                        ← 恢复真实角色
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {tenantUser && <span className="text-[9px] text-gray-500">{tenantUser}</span>}
          <button onClick={handleTenantLogout} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 hover:text-red-400" title="退出租户登录">🚪</button>
        </div>
      </div>
      {profile?.pending_notifications?.map((n, i) => (
        <div key={i} className="mt-1 pt-1 border-t border-gray-700/30 text-[10px] text-yellow-400 flex items-center gap-1">
          <span>📢</span><span>{n.message}</span>
        </div>
      ))}
    </div>
  );

  const errorBanner = error && (
    <div className="bg-gray-800/30 rounded-lg px-3 py-2 border border-amber-500/20 mb-3 flex items-center gap-2">
      <span className="text-[9px] text-amber-400/70">⚠</span>
      <span className="text-[9px] text-gray-500 flex-1">API不可用 {isManualMode ? '(预览模式)' : ''}</span>
      <button onClick={loadProfile} className="text-[9px] text-blue-400 hover:text-blue-300 shrink-0">重试</button>
    </div>
  );

  const renderDashboard = () => {
    const dashboard = (() => {
      switch (role) {
        case 'owner': case 'admin': return <TenantAdminDashboard cloudApi={tenantApi} />;
        case 'project_manager': return <ProjectManagerDashboard cloudApi={tenantApi} />;
        case 'worker': case 'technician': return <WorkerDashboard cloudApi={tenantApi} />;
        default: return <div className="text-center py-8"><p className="text-xs text-gray-500">暂无可用看板</p></div>;
      }
    })();
    return <>{errorBanner}{roleHeader}{dashboard}</>;
  };

  return renderDashboard();
}
