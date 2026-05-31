import React, { useState, useEffect } from 'react';
import type { StatsCard, QuickModule } from './types';

interface Props {
  cloudApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
}

/** 租户管理员看板：项目管理、资金统计、客户管理、团队概览 */
export function TenantAdminDashboard({ cloudApi }: Props) {
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      // 并行加载各模块数据
      const [dashboardData, projectsData, customersData] = await Promise.allSettled([
        cloudApi('/api/v1/tenant-admin/dashboard'),
        cloudApi('/api/v1/tenant-admin/projects'),
        cloudApi('/api/v1/tenant-admin/customers'),
      ]);

      // 看板统计
      if (dashboardData.status === 'fulfilled' && dashboardData.value?.data) {
        const d = dashboardData.value.data;
        const items: StatsCard[] = [
          { label: '团队成员', value: d.team?.member_count ?? 0, color: 'text-blue-400', icon: '👥' },
          { label: '总会话数', value: d.chat?.total_sessions ?? 0, color: 'text-green-400', icon: '💬' },
          { label: '今日消息', value: d.chat?.today_messages ?? 0, color: 'text-yellow-400', icon: '📝' },
          { label: '活跃邀请码', value: d.team?.invite_active ?? 0, color: 'text-purple-400', icon: '🔗' },
        ];
        setStats(items);
      }

      // 项目列表
      if (projectsData.status === 'fulfilled' && Array.isArray(projectsData.value?.data)) {
        setRecentProjects(projectsData.value.data.slice(0, 5));
      }

      // 客户列表
      if (customersData.status === 'fulfilled' && Array.isArray(customersData.value?.data)) {
        setRecentCustomers(customersData.value.data.slice(0, 5));
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const quickModules: QuickModule[] = [
    { id: 'projects', label: '项目管理', icon: '📋', description: '查看和管理所有项目', color: 'text-blue-400' },
    { id: 'finance', label: '资金管理', icon: '💰', description: '收支记录与汇总统计', color: 'text-green-400' },
    { id: 'customers', label: '客户管理', icon: '👤', description: '客户信息与跟进状态', color: 'text-yellow-400' },
    { id: 'team', label: '团队管理', icon: '👥', description: '成员管理与角色分配', color: 'text-purple-400' },
    { id: 'invoices', label: '发票管理', icon: '🧾', description: '发票录入与状态追踪', color: 'text-orange-400' },
    { id: 'contracts', label: '合同管理', icon: '📄', description: '合同生成与审核', color: 'text-cyan-400' },
  ];

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4 py-8">
          <p className="text-red-400 text-xs mb-2">{error}</p>
          <button onClick={loadDashboard} className="text-[10px] px-3 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 快速入口模块 */}
      <div>
        <h3 className="text-xs text-gray-400 font-medium mb-2">快捷功能</h3>
        <div className="grid grid-cols-2 gap-2">
          {quickModules.map(m => (
            <div
              key={m.id}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-lg p-3 cursor-pointer transition-colors"
              title={m.description}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{m.icon}</span>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${m.color}`}>{m.label}</p>
                  <p className="text-[9px] text-gray-500 truncate">{m.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 统计卡片 */}
      {stats.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-400 font-medium mb-2">数据概览</h3>
          <div className="grid grid-cols-2 gap-2">
            {stats.map(s => (
              <div key={s.label} className="bg-gray-800/70 rounded-lg p-3 border border-gray-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{s.icon}</span>
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                </div>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近项目 */}
      {recentProjects.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-400 font-medium mb-2">最近项目</h3>
          <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 divide-y divide-gray-700/30">
            {recentProjects.map((p: any) => (
              <div key={p.id} className="px-3 py-2 flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="text-gray-200 truncate flex-1">{p.name}</span>
                <span className="text-gray-500 text-[10px]">
                  {p.status === 'in_progress' ? '进行中' : p.status === 'completed' ? '已完成' : p.status || '未开始'}
                </span>
                {p.contract_amount ? (
                  <span className="text-gray-400 text-[10px]">¥{Number(p.contract_amount).toLocaleString()}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近客户 */}
      {recentCustomers.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-400 font-medium mb-2">最近客户</h3>
          <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 divide-y divide-gray-700/30">
            {recentCustomers.map((c: any) => (
              <div key={c.id} className="px-3 py-2 flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-gray-200 truncate flex-1">{c.name}</span>
                {c.phone && <span className="text-gray-500 text-[10px]">{c.phone}</span>}
                <span className="text-gray-500 text-[10px]">{c.status === 'lead' ? '潜在客户' : c.status === 'negotiating' ? '洽谈中' : c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="text-center py-6">
          <span className="text-xs text-gray-500">加载中...</span>
        </div>
      )}
    </div>
  );
}
