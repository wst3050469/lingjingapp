import React, { useState, useEffect } from 'react';
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

/** 角色仪表盘统一入口 — 根据用户角色渲染对应的看板 */
export function RoleDashboard({ cloudApi, serverUrl, isLoggedIn }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      } else if (res?.code === 0) {
        // 已登录但无 tenant_role（个人用户或邀请码用户）
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
      // 如果 profile API 不可用，不阻塞页面
      console.warn('[RoleDashboard] Failed to load profile:', err.message);
      setError('');
    } finally {
      setLoading(false);
    }
  };

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

  // 已登录但无 tenant_role（个人用户）
  if (!profile?.tenant_role) {
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

  const role = profile.tenant_role;
  const roleLabel = ROLE_LABELS[role] || role;

  // 顶部角色信息栏
  const roleHeader = (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{role === 'owner' || role === 'admin' ? '🏢' : role === 'project_manager' ? '📊' : role === 'worker' ? '🔧' : '👤'}</span>
          <div>
            <p className="text-xs text-gray-200 font-medium">{profile.company_name || '企业'}</p>
            <p className="text-[10px] text-gray-500">{profile.nickname} · {roleLabel}</p>
          </div>
        </div>
        {serverUrl && (
          <span className="text-[9px] text-gray-600 truncate max-w-[120px]" title={serverUrl}>
            {serverUrl.replace(/^https?:\/\//, '')}
          </span>
        )}
      </div>
      {/* 待处理通知 */}
      {profile.pending_notifications && profile.pending_notifications.length > 0 && (
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

  // 根据角色渲染对应看板
  const renderDashboard = () => {
    switch (role) {
      case 'owner':
      case 'admin':
        return (
          <>
            {roleHeader}
            <TenantAdminDashboard cloudApi={cloudApi} />
          </>
        );
      case 'project_manager':
        return (
          <>
            {roleHeader}
            <ProjectManagerDashboard cloudApi={cloudApi} />
          </>
        );
      case 'worker':
        return (
          <>
            {roleHeader}
            <WorkerDashboard cloudApi={cloudApi} />
          </>
        );
      case 'technician':
        // 技术员暂时使用工人看板
        return (
          <>
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
