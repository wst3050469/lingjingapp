import React, { useState, useEffect } from 'react';
import type { StatsCard, QuickModule } from './types';

interface Props {
  cloudApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
}

/** 资金管理模态框 */
function FinanceModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    cloudApi('/api/v1/tenant-admin/finance')
      .then(d => setRecords(d?.data || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const income = records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
  const expense = records.filter(r => r.type !== 'income').reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">💰</span>
          <h3 className="text-sm text-gray-200 font-medium">资金管理</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
                <div className="text-[9px] text-gray-500 mb-1">总收入</div>
                <div className="text-lg font-bold text-green-400">¥{income.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
                <div className="text-[9px] text-gray-500 mb-1">总支出</div>
                <div className="text-lg font-bold text-red-400">¥{expense.toLocaleString()}</div>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-1 max-h-48">
              {records.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500">暂无记录</div>
              ) : (
                records.slice(0, 30).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between bg-gray-900/30 rounded px-3 py-2 border border-gray-700/20">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-300 truncate">{r.reason || r.category || '-'}</div>
                      <div className="text-[9px] text-gray-600">{r.created_at?.slice(0, 10) || ''}</div>
                    </div>
                    <span className={`text-xs shrink-0 ml-2 ${r.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                      {r.type === 'income' ? '+' : '-'}¥{Number(r.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 团队管理模态框 */
function TeamModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    cloudApi('/api/v1/tenant-admin/team-info')
      .then(d => setData(d?.data))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">👥</span>
          <h3 className="text-sm text-gray-200 font-medium">团队管理</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {data && (
          <div className="space-y-3">
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">企业</span>
                <span className="text-gray-200">{data.company_name}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">管理员</span>
                <span className="text-gray-200">{data.owner_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">成员数</span>
                <span className="text-blue-400">{data.members?.length || 0} 人</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-1 max-h-48">
              <div className="text-[10px] text-gray-500 font-medium mb-1">团队成员</div>
              {data.members?.map((m: any) => (
                <div key={m.user_id} className="flex items-center justify-between bg-gray-900/30 rounded px-3 py-2 border border-gray-700/20">
                  <div>
                    <span className="text-xs text-gray-300">{m.name || m.user_id}</span>
                    {m.phone && <span className="text-[9px] text-gray-600 ml-2">{m.phone}</span>}
                  </div>
                  <span className="text-[10px] text-blue-400">{m.role === 'admin' ? '管理员' : m.role === 'owner' ? '所有者' : m.role === 'worker' ? '工人' : m.role === 'project_manager' ? '项目经理' : m.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 发票管理模态框 */
function InvoiceModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    cloudApi('/api/v1/tenant-admin/invoices')
      .then(d => setInvoices(d?.data || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const totalAmount = invoices.reduce((s, i) => s + Number(i.total_amount || i.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">🧾</span>
          <h3 className="text-sm text-gray-200 font-medium">发票管理</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && (
          <div className="space-y-3">
            <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
              <div className="text-[9px] text-gray-500 mb-1">发票总额</div>
              <div className="text-lg font-bold text-yellow-400">¥{totalAmount.toLocaleString()}</div>
              <div className="text-[9px] text-gray-500 mt-1">共 {invoices.length} 张</div>
            </div>

            <div className="flex-1 overflow-auto space-y-1 max-h-48">
              {invoices.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500">暂无发票</div>
              ) : (
                invoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between bg-gray-900/30 rounded px-3 py-2 border border-gray-700/20">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-300 truncate">{inv.title || inv.invoice_no || '未命名'}</div>
                      <div className="text-[9px] text-gray-600">
                        {inv.invoice_date?.slice(0, 10) || ''} · {inv.invoice_type === 'sales' ? '销项' : inv.invoice_type === 'purchase' ? '进项' : inv.invoice_type}
                        {inv.project_name ? ` · ${inv.project_name}` : ''}
                      </div>
                    </div>
                    <span className="text-xs text-yellow-400 shrink-0 ml-2">¥{Number(inv.total_amount || inv.amount || 0).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 合同管理模态框 */
function ContractModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    cloudApi('/api/v1/tenant-admin/contracts')
      .then(d => setContracts(d?.data || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">📄</span>
          <h3 className="text-sm text-gray-200 font-medium">合同管理</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && (
          <div className="flex-1 overflow-auto space-y-1 min-h-0">
            {contracts.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-500">暂无合同</div>
            ) : (
              contracts.map((c: any) => (
                <div key={c.id} className="bg-gray-900/30 rounded px-3 py-2.5 border border-gray-700/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-200 font-medium">{c.title || c.name || '未命名'}</span>
                    <span className={`text-[10px] ${c.status === 'signed' ? 'text-green-400' : c.status === 'draft' ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {c.status === 'signed' ? '已签约' : c.status === 'draft' ? '草稿' : c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    {c.partner_name && <span>对方: {c.partner_name}</span>}
                    {c.amount && <span>¥{Number(c.amount).toLocaleString()}</span>}
                  </div>
                  {c.sign_date && <div className="text-[9px] text-gray-600 mt-1">签约日期: {c.sign_date?.slice(0, 10)}</div>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 项目管理模态框 */
function ProjectsModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    cloudApi('/api/v1/tenant-admin/projects')
      .then(d => setProjects(d?.data || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const statusLabels: Record<string, string> = {
    not_started: '未开始', in_progress: '进行中', completed: '已完成', on_hold: '已暂停', cancelled: '已取消',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">📋</span>
          <h3 className="text-sm text-gray-200 font-medium">项目管理</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && (
          <div className="flex-1 overflow-auto space-y-1 min-h-0">
            {projects.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-500">暂无项目</div>
            ) : (
              projects.map((p: any) => (
                <div key={p.id} className="bg-gray-900/30 rounded px-3 py-2.5 border border-gray-700/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-200 font-medium">{p.name}</span>
                    <span className={`text-[10px] ${p.status === 'in_progress' ? 'text-blue-400' : p.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {statusLabels[p.status] || p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    {p.manager_name && <span>负责人: {p.manager_name}</span>}
                    {p.contract_amount != null && <span>¥{Number(p.contract_amount).toLocaleString()}</span>}
                  </div>
                  {p.progress != null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(p.progress, 100)}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-600">{p.progress}%</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 客户管理模态框 */
function CustomersModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    cloudApi('/api/v1/tenant-admin/customers')
      .then(d => setCustomers(d?.data || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const statusLabels: Record<string, string> = {
    lead: '潜在客户', negotiating: '洽谈中', contracted: '已签约', lost: '已流失',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">👤</span>
          <h3 className="text-sm text-gray-200 font-medium">客户管理</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && (
          <div className="flex-1 overflow-auto space-y-1 min-h-0">
            {customers.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-500">暂无客户</div>
            ) : (
              customers.map((c: any) => (
                <div key={c.id} className="bg-gray-900/30 rounded px-3 py-2.5 border border-gray-700/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-200 font-medium">{c.name}</span>
                    <span className={`text-[10px] ${c.status === 'lead' ? 'text-blue-400' : c.status === 'negotiating' ? 'text-yellow-400' : c.status === 'contracted' ? 'text-green-400' : 'text-gray-400'}`}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    {c.contact_person && <span>{c.contact_person}</span>}
                    {c.phone && <span>{c.phone}</span>}
                    {c.email && <span>{c.email}</span>}
                  </div>
                  {c.notes && <div className="text-[9px] text-gray-600 mt-1 truncate">{c.notes}</div>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 租户管理员看板：项目管理、资金统计、客户管理、团队概览 */
export function TenantAdminDashboard({ cloudApi }: Props) {
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showFinance, setShowFinance] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showContracts, setShowContracts] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const handleModuleClick = (label: string, id: string) => {
    if (id === 'finance') { setShowFinance(true); return; }
    if (id === 'team') { setShowTeam(true); return; }
    if (id === 'invoices') { setShowInvoices(true); return; }
    if (id === 'contracts') { setShowContracts(true); return; }
    if (id === 'projects') { setShowProjects(true); return; }
    if (id === 'customers') { setShowCustomers(true); return; }
    showToast(`${label} — 功能开发中`);
  };

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
              onClick={() => handleModuleClick(m.label, m.id)}
              className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-lg p-3 cursor-pointer transition-colors active:scale-[0.98]"
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-gray-200 text-xs px-4 py-2 rounded-lg border border-gray-600 shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* 资金管理模态框 */}
      {showFinance && <FinanceModal onClose={() => setShowFinance(false)} cloudApi={cloudApi} />}

      {/* 团队管理模态框 */}
      {showTeam && <TeamModal onClose={() => setShowTeam(false)} cloudApi={cloudApi} />}

      {/* 发票管理模态框 */}
      {showInvoices && <InvoiceModal onClose={() => setShowInvoices(false)} cloudApi={cloudApi} />}

      {/* 合同管理模态框 */}
      {showContracts && <ContractModal onClose={() => setShowContracts(false)} cloudApi={cloudApi} />}

      {/* 项目管理模态框 */}
      {showProjects && <ProjectsModal onClose={() => setShowProjects(false)} cloudApi={cloudApi} />}

      {/* 客户管理模态框 */}
      {showCustomers && <CustomersModal onClose={() => setShowCustomers(false)} cloudApi={cloudApi} />}
    </div>
  );
}
