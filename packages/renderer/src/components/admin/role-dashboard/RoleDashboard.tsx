import React, { useState, useEffect, useCallback } from 'react';
import type { TenantRole, UserProfile } from './types';
import { ROLE_LABELS } from './types';
import { TenantAdminDashboard } from './TenantAdminDashboard';
import { ProjectManagerDashboard } from './ProjectManagerDashboard';
import { WorkerDashboard } from './WorkerDashboard';

interface Props {
  /** 连接云端 API 的代理函数 */
  cloudApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
  /** 当前已登录的云服务器地址（用于显示） */
  serverUrl?: string;
  /** 是否已登录云管理后台 */
  isLoggedIn: boolean;
}

const ROLE_PERSIST_KEY = 'admin_role_override';
const ALL_ROLES: { value: TenantRole; label: string; icon: string }[] = [
  { value: 'admin', label: '租户管理员', icon: '🏢' },
  { value: 'project_manager', label: '项目经理', icon: '📊' },
  { value: 'worker', label: '工人', icon: '🔧' },
  { value: 'technician', label: '技术员', icon: '🔬' },
];

/** 角色仪表盘统一入口 — 根据用户角色渲染对应的看板 */
export function RoleDashboard({ cloudApi, serverUrl, isLoggedIn }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [manualRole, setManualRole] = useState<TenantRole>(() => {
    // 尝试从 localStorage 恢复手动选中的角色
    const saved = localStorage.getItem(ROLE_PERSIST_KEY);
    if (saved === 'admin' || saved === 'project_manager' || saved === 'worker' || saved === 'technician') {
      return saved;
    }
    return null;
  });
  const [showRolePicker, setShowRolePicker] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn]);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await cloudApi('/api/v1/user/profile');
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
        // API 成功获取角色后，清除手动覆盖
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
      console.warn('[RoleDashboard] Profile API unavailable:', err.message);
      setError(err.message || '无法连接到租户服务器');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRoleSelect = useCallback((role: TenantRole) => {
    setManualRole(role);
    setShowRolePicker(false);
    if (role) {
      localStorage.setItem(ROLE_PERSIST_KEY, role);
    } else {
      localStorage.removeItem(ROLE_PERSIST_KEY);
    }
    // 构建一个模拟 profile
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

  // 未登录
  if (!isLoggedIn) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-xs text-gray-500">加载用户信息...</span>
      </div>
    );
  }

  // 角色选择器（API 失败时允许手动选择）
  const rolePicker = (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-amber-500/30 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-amber-400 font-medium">⚠️ 未能自动获取角色</span>
        <button
          onClick={() => loadProfile()}
          className="text-[9px] px-2 py-0.5 rounded bg-gray-700 text-gray-400 hover:text-gray-200 ml-auto"
        >
          重试
        </button>
      </div>
      <p className="text-[10px] text-gray-500 mb-2">请手动选择一个角色来预览看板：</p>
      {showRolePicker ? (
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => handleManualRoleSelect(r.value)}
              className={`text-left px-2.5 py-2 rounded border text-xs transition-colors ${
                manualRole === r.value
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-gray-600/50 bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              <span className="mr-1">{r.icon}</span>
              {r.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setShowRolePicker(true)}
          className="text-[11px] px-3 py-1.5 rounded bg-gray-700/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-dashed border-gray-600/50"
        >
          🎯 选择角色预览...
        </button>
      )}
    </div>
  );

  // 确定最终使用的角色：profile的 > 手动选择的
  const effectiveRole = profile?.tenant_role || manualRole;

  // 有 profile 但无角色 & 不是手动模式
  if (profile && !effectiveRole && !error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4 py-8 max-w-xs">
          <div className="text-3xl mb-3">👤</div>
          <p className="text-sm text-gray-400 font-medium mb-1">个人用户</p>
          <p className="text-[10px] text-gray-500">当前账号未关联企业租户，没有角色对应的仪表盘</p>
        </div>
      </div>
    );
  }

  // 无任何有效角色（API 失败 & 未手动选择）
  if (!effectiveRole && error) {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-8">
        {rolePicker}
      </div>
    );
  }

  const role = effectiveRole!;
  const roleLabel = ROLE_LABELS[role] || role;
  const isManualMode = !profile?.tenant_role && !!manualRole;

  // 顶部角色信息栏
  const roleHeader = (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{role === 'owner' || role === 'admin' ? '🏢' : role === 'project_manager' ? '📊' : role === 'worker' ? '🔧' : role === 'technician' ? '🔬' : '👤'}</span>
          <div>
            <p className="text-xs text-gray-200 font-medium">{profile?.company_name || '企业'}</p>
            <p className="text-[10px] text-gray-500">
              {profile?.nickname || '用户'} · {roleLabel}
              {isManualMode && <span className="text-amber-400 ml-1">(预览)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {serverUrl && (
            <span className="text-[9px] text-gray-600 truncate max-w-[100px]" title={serverUrl}>
              {serverUrl.replace(/^https?:\/\//, '')}
            </span>
          )}
          {/* 手动切换角色按钮 */}
          {isManualMode && (
            <button
              onClick={() => setShowRolePicker(!showRolePicker)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 hover:text-gray-200 ml-1"
              title="切换角色"
            >
              🔄
            </button>
          )}
        </div>
      </div>
      {/* 待处理通知 */}
      {profile?.pending_notifications && profile.pending_notifications.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700/30 space-y-1">
          {profile.pending_notifications.map((n, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-yellow-400">
              <span>📢</span>
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // API 失败的警告条
  const errorBanner = error && (
    <div className="bg-gray-800/30 rounded-lg px-3 py-2 border border-amber-500/20 mb-3 flex items-center gap-2">
      <span className="text-[9px] text-amber-400/70">⚠</span>
      <span className="text-[9px] text-gray-500 flex-1">租户API不可用，数据可能为空。{isManualMode ? '已启用预览模式。' : ''}</span>
      <button onClick={() => loadProfile()} className="text-[9px] text-blue-400 hover:text-blue-300 shrink-0">重试</button>
    </div>
  );

  // 手动选择器浮层
  const manualPicker = showRolePicker && isManualMode && (
    <div className="bg-gray-800/80 rounded-lg p-3 border border-gray-600/50 mb-3">
      <p className="text-[10px] text-gray-500 mb-2">切换角色预览：</p>
      <div className="grid grid-cols-2 gap-1.5">
        {ALL_ROLES.map(r => (
          <button
            key={r.value}
            onClick={() => { handleManualRoleSelect(r.value); setShowRolePicker(false); }}
            className={`text-left px-2.5 py-2 rounded border text-xs transition-colors ${
              role === r.value
                ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                : 'border-gray-600/50 bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            <span className="mr-1">{r.icon}</span>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );

  // 根据角色渲染对应看板
  const renderDashboard = () => {
    switch (role) {
      case 'owner':
      case 'admin':
        return (
          <>
            {errorBanner}
            {manualPicker}
            {roleHeader}
            <TenantAdminDashboard cloudApi={cloudApi} />
          </>
        );
      case 'project_manager':
        return (
          <>
            {errorBanner}
            {manualPicker}
            {roleHeader}
            <ProjectManagerDashboard cloudApi={cloudApi} />
          </>
        );
      case 'worker':
        return (
          <>
            {errorBanner}
            {manualPicker}
            {roleHeader}
            <WorkerDashboard cloudApi={cloudApi} />
          </>
        );
      case 'technician':
        return (
          <>
            {errorBanner}
            {manualPicker}
            {roleHeader}
            <WorkerDashboard cloudApi={cloudApi} />
          </>
        );
      default:
        return (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">角色「{roleLabel}」暂无可用的仪表盘</p>
          </div>
        );
    }
  };

  return renderDashboard();
}
