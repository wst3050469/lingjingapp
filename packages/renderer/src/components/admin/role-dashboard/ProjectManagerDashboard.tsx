import React, { useState, useEffect } from 'react';
import type { QuickModule } from './types';

interface Props {
  cloudApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
}

/** 项目经理看板：项目进度、质量看板、耗材统计、支出记录 */
export function ProjectManagerDashboard({ cloudApi }: Props) {
  const [projects, setProjects] = useState<any[]>([]);
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [projectsRes, financeRes] = await Promise.allSettled([
        cloudApi('/api/v1/tenant-admin/projects'),
        cloudApi('/api/v1/tenant-admin/finance/project-summary'),
      ]);

      if (projectsRes.status === 'fulfilled' && Array.isArray(projectsRes.value?.data)) {
        setProjects(projectsRes.value.data);
      }
      if (financeRes.status === 'fulfilled' && financeRes.value?.summary) {
        setFinanceSummary(financeRes.value.summary);
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const quickModules: QuickModule[] = [
    { id: 'progress', label: '项目进度', icon: '📊', description: '查看各项目进展状态', color: 'text-blue-400' },
    { id: 'quality', label: '质量看板', icon: '✅', description: '质量检查与问题追踪', color: 'text-green-400' },
    { id: 'materials', label: '耗材管理', icon: '📦', description: '耗材入库与领用记录', color: 'text-yellow-400' },
    { id: 'expenses', label: '支出记录', icon: '💸', description: '费用申请与审批', color: 'text-red-400' },
    { id: 'attendance', label: '考勤查看', icon: '⏰', description: '团队出勤情况', color: 'text-purple-400' },
    { id: 'suppliers', label: '供应商', icon: '🏭', description: '供应商信息与报价', color: 'text-cyan-400' },
  ];

  const statusLabels: Record<string, string> = {
    not_started: '未开始',
    in_progress: '进行中',
    completed: '已完成',
    on_hold: '已暂停',
    cancelled: '已取消',
  };

  const statusColors: Record<string, string> = {
    not_started: 'bg-gray-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500',
    on_hold: 'bg-yellow-500',
    cancelled: 'bg-red-500',
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4 py-8">
          <p className="text-red-400 text-xs mb-2">{error}</p>
          <button onClick={loadData} className="text-[10px] px-3 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 快捷功能模块 */}
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

      {/* 财务汇总 */}
      {financeSummary && (
        <div>
          <h3 className="text-xs text-gray-400 font-medium mb-2">收支汇总</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800/70 rounded-lg p-3 border border-gray-700/50">
              <div className="text-[10px] text-gray-500 mb-1">总收入</div>
              <div className="text-sm font-bold text-green-400">¥{Number(financeSummary.total_income || 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-800/70 rounded-lg p-3 border border-gray-700/50">
              <div className="text-[10px] text-gray-500 mb-1">总支出</div>
              <div className="text-sm font-bold text-red-400">¥{Number(financeSummary.total_expense || 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-800/70 rounded-lg p-3 border border-gray-700/50">
              <div className="text-[10px] text-gray-500 mb-1">利润</div>
              <div className={`text-sm font-bold ${(financeSummary.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ¥{Number(financeSummary.profit || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 项目列表 */}
      {projects.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-400 font-medium mb-2">项目列表 ({projects.length})</h3>
          <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 divide-y divide-gray-700/30">
            {projects.map((p: any) => (
              <div key={p.id} className="px-3 py-2.5 flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusColors[p.status] || 'bg-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-200 truncate">{p.name}</span>
                    {p.customer && <span className="text-gray-500 text-[10px] truncate">{p.customer}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[9px] text-gray-600">{statusLabels[p.status] || p.status}</span>
                    {p.progress != null && (
                      <span className="text-[9px] text-gray-600">{p.progress}%</span>
                    )}
                    {p.manager_name && (
                      <span className="text-[9px] text-gray-600">负责人: {p.manager_name}</span>
                    )}
                  </div>
                </div>
                {p.contract_amount ? (
                  <span className="text-gray-400 text-[10px] shrink-0">¥{Number(p.contract_amount).toLocaleString()}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-6">
          <span className="text-xs text-gray-500">加载中...</span>
        </div>
      )}
    </div>
  );
}
