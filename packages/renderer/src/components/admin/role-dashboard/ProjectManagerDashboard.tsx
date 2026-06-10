import React, { useState, useEffect, useRef } from 'react';
import type { QuickModule } from './types';

interface Props {
  cloudApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
}

/** 支出记录模态框 */
function FinanceModal({
  onClose,
  cloudApi,
}: {
  onClose: () => void;
  cloudApi: Props['cloudApi'];
}) {
  const [records, setRecords] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    project_id: '', type: 'expense', category: '', amount: '',
    reason: '', expense_date: new Date().toISOString().slice(0, 10),
  });

  const loadData = () => {
    setLoading(true);
    setErr('');
    Promise.all([
      cloudApi('/api/v1/tenant-admin/finance').then(d => setRecords(d?.data || [])),
      cloudApi('/api/v1/tenant-admin/projects').then(d => setProjects(d?.data || [])),
    ])
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setErr('金额必须大于0'); return; }
    if (!form.reason.trim()) { setErr('请输入用途说明'); return; }
    setSubmitting(true);
    setErr('');
    try {
      await cloudApi('/api/v1/tenant-admin/finance', 'POST', {
        project_id: form.project_id ? Number(form.project_id) : null,
        type: form.type,
        category: form.category,
        amount: Number(form.amount),
        reason: form.reason,
        expense_date: form.expense_date,
      });
      setShowForm(false);
      setForm({ project_id: '', type: 'expense', category: '', amount: '',
        reason: '', expense_date: new Date().toISOString().slice(0, 10) });
      loadData();
    } catch (e: any) {
      setErr(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const totalExpense = records
    .filter(r => r.type === 'expense' || r.type === 'fund_application' || r.type === 'wage')
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const typeLabels: Record<string, string> = {
    expense: '支出', income: '收入', fund_application: '备用金', wage: '工资',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">💸</span>
          <h3 className="text-sm text-gray-200 font-medium">{showForm ? '新增支出' : '支出记录'}</h3>
          <button onClick={showForm ? () => { setShowForm(false); setErr(''); } : onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && !showForm && (
          <div className="space-y-3">
            <button onClick={() => setShowForm(true)} className="text-[10px] px-3 py-1.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 self-start">+ 新增支出</button>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
              <div className="text-[9px] text-gray-500 mb-1">支出总额</div>
              <div className="text-lg font-bold text-red-400">¥{totalExpense.toLocaleString()}</div>
            </div>

            <div className="flex-1 overflow-auto space-y-1 max-h-60">
              {records.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500">暂无记录</div>
              ) : (
                records.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between bg-gray-900/30 rounded px-3 py-2 border border-gray-700/20">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-300 truncate">
                        {r.reason || r.category || '-'}
                      </div>
                      <div className="text-[9px] text-gray-600">
                        {r.project_name ? `${r.project_name} · ` : ''}
                        {r.created_at?.slice(0, 10) || ''} · {typeLabels[r.type] || r.type}
                      </div>
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

        {!loading && showForm && (
          <div className="space-y-3 flex-1 overflow-auto min-h-0">
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">类型</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500">
                <option value="expense">支出</option>
                <option value="income">收入</option>
                <option value="fund_application">备用金</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">项目</label>
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500">
                <option value="">选择项目（可选）</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">用途说明 *</label>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" placeholder="如：材料采购、设备租赁..." />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">金额 *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" placeholder="0.00" />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">分类</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" placeholder="如：材料费" />
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">日期</label>
              <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 text-[10px] px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                {submitting ? '提交中...' : '提交'}
              </button>
              <button onClick={() => { setShowForm(false); setErr(''); }}
                className="text-[10px] px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 供应商模态框 */
function SupplierModal({
  onClose,
  cloudApi,
}: {
  onClose: () => void;
  cloudApi: Props['cloudApi'];
}) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', contact_person: '', phone: '', category: '',
    status: 'prospect', notes: '',
  });

  const loadData = () => {
    setLoading(true);
    setErr('');
    cloudApi('/api/v1/tenant-admin/suppliers')
      .then(d => setSuppliers(d?.data || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('请输入供应商名称'); return; }
    setSubmitting(true);
    setErr('');
    try {
      await cloudApi('/api/v1/tenant-admin/suppliers', 'POST', {
        name: form.name.trim(),
        contact_person: form.contact_person,
        phone: form.phone,
        category: form.category,
        status: form.status,
        notes: form.notes,
      });
      setShowForm(false);
      setForm({ name: '', contact_person: '', phone: '', category: '', status: 'prospect', notes: '' });
      loadData();
    } catch (e: any) {
      setErr(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabels: Record<string, string> = {
    active: '合作中', inactive: '已暂停', prospect: '潜在', blacklisted: '已拉黑',
  };
  const statusColors: Record<string, string> = {
    active: 'text-green-400', inactive: 'text-yellow-400', prospect: 'text-blue-400', blacklisted: 'text-red-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">🏭</span>
          <h3 className="text-sm text-gray-200 font-medium">{showForm ? '新增供应商' : '供应商'}</h3>
          <button onClick={showForm ? () => { setShowForm(false); setErr(''); } : onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && !showForm && (
          <>
            <button onClick={() => setShowForm(true)} className="mb-3 text-[10px] px-3 py-1.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 self-start">+ 新增供应商</button>
            <div className="flex-1 overflow-auto space-y-1 min-h-0">
              {suppliers.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500">暂无供应商</div>
              ) : (
                suppliers.map((s: any) => (
                  <div key={s.id} className="bg-gray-900/30 rounded px-3 py-2.5 border border-gray-700/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-200 font-medium">{s.name}</span>
                      <span className={`text-[10px] ${statusColors[s.status] || 'text-gray-400'}`}>
                        {statusLabels[s.status] || s.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      {s.contact_person && <span>{s.contact_person}</span>}
                      {s.phone && <span>{s.phone}</span>}
                      {s.category && <span>{s.category}</span>}
                    </div>
                    {s.notes && <div className="text-[9px] text-gray-600 mt-1 truncate">{s.notes}</div>}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {!loading && showForm && (
          <div className="space-y-3 flex-1 overflow-auto min-h-0">
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">供应商名称 *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" placeholder="如：XX建材公司" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">联系人</label>
                <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">电话</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">分类</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" placeholder="如：建材" />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">状态</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500">
                  <option value="prospect">潜在</option>
                  <option value="active">合作中</option>
                  <option value="inactive">已暂停</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">备注</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 text-[10px] px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                {submitting ? '提交中...' : '提交'}
              </button>
              <button onClick={() => { setShowForm(false); setErr(''); }}
                className="text-[10px] px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 质量看板模态框 */
function QualityModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [records, setRecords] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    project_id: '', inspection_type: '常规检查', inspection_date: new Date().toISOString().slice(0, 10),
    inspector_name: '', result: 'pass', issues: '', remark: '',
  });

  const loadData = () => {
    setLoading(true);
    setErr('');
    Promise.all([
      cloudApi('/api/v1/tenant-admin/quality').then(d => setRecords(d?.data || [])),
      cloudApi('/api/v1/tenant-admin/projects').then(d => setProjects(d?.data || [])),
    ])
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async () => {
    if (!form.project_id) { setErr('请选择项目'); return; }
    setSubmitting(true);
    setErr('');
    try {
      await cloudApi('/api/v1/tenant-admin/quality', 'POST', {
        ...form,
        project_id: Number(form.project_id),
      });
      setShowForm(false);
      setForm({ project_id: '', inspection_type: '常规检查', inspection_date: new Date().toISOString().slice(0, 10),
        inspector_name: '', result: 'pass', issues: '', remark: '' });
      loadData();
    } catch (e: any) {
      setErr(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">✅</span>
          <h3 className="text-sm text-gray-200 font-medium">{showForm ? '新增质检' : '质量看板'}</h3>
          <button onClick={showForm ? () => { setShowForm(false); setErr(''); } : onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && !showForm && (
          <>
            <button onClick={() => setShowForm(true)} className="mb-3 text-[10px] px-3 py-1.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 self-start">+ 新增质检</button>
            <div className="flex-1 overflow-auto space-y-1 min-h-0">
              {records.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500">暂无质检记录</div>
              ) : (
                records.map((r: any) => (
                  <div key={r.id} className="bg-gray-900/30 rounded px-3 py-2.5 border border-gray-700/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-200 font-medium">{r.inspection_type || '质检'}</span>
                      <span className={`text-[10px] ${r.result === 'pass' ? 'text-green-400' : r.result === 'fail' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {r.result === 'pass' ? '合格' : r.result === 'fail' ? '不合格' : r.result || '待检'}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {r.project_name && <span className="text-gray-600">{r.project_name} · </span>}
                      {r.inspector_name && <span>{r.inspector_name} · </span>}
                      {r.inspection_date && <span>{r.inspection_date?.slice(0, 10)}</span>}
                    </div>
                    {r.issues && <div className="text-[9px] text-red-400/70 mt-1">{r.issues}</div>}
                    {r.remark && <div className="text-[9px] text-gray-600 mt-0.5">{r.remark}</div>}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {!loading && showForm && (
          <div className="space-y-3 flex-1 overflow-auto min-h-0">
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">项目 *</label>
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500">
                <option value="">选择项目</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">检测类型</label>
              <input value={form.inspection_type} onChange={e => setForm(f => ({ ...f, inspection_type: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">结果 *</label>
                <select value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500">
                  <option value="pass">合格</option>
                  <option value="fail">不合格</option>
                  <option value="pending">待检</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">检测人</label>
                <input value={form.inspector_name} onChange={e => setForm(f => ({ ...f, inspector_name: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">检测日期</label>
              <input type="date" value={form.inspection_date} onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">问题描述</label>
              <textarea value={form.issues} onChange={e => setForm(f => ({ ...f, issues: e.target.value }))} rows={2}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 resize-none" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">备注</label>
              <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} rows={1}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 text-[10px] px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                {submitting ? '提交中...' : '提交'}
              </button>
              <button onClick={() => { setShowForm(false); setErr(''); }}
                className="text-[10px] px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 耗材管理模态框 */
function MaterialsModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [records, setRecords] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    project_id: '', material_desc: '', amount: '', supplier_name: '',
    expense_date: new Date().toISOString().slice(0, 10), remark: '',
  });

  const loadData = () => {
    setLoading(true);
    setErr('');
    Promise.all([
      cloudApi('/api/v1/tenant-admin/materials').then(d => setRecords(d?.data || [])),
      cloudApi('/api/v1/tenant-admin/projects').then(d => setProjects(d?.data || [])),
    ])
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async () => {
    if (!form.material_desc.trim()) { setErr('请输入耗材描述'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setErr('金额必须大于0'); return; }
    setSubmitting(true);
    setErr('');
    try {
      await cloudApi('/api/v1/tenant-admin/materials', 'POST', {
        project_id: form.project_id ? Number(form.project_id) : null,
        material_desc: form.material_desc.trim(),
        amount: Number(form.amount),
        supplier_name: form.supplier_name,
        expense_date: form.expense_date,
        remark: form.remark,
      });
      setShowForm(false);
      setForm({ project_id: '', material_desc: '', amount: '', supplier_name: '',
        expense_date: new Date().toISOString().slice(0, 10), remark: '' });
      loadData();
    } catch (e: any) {
      setErr(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const total = records.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">📦</span>
          <h3 className="text-sm text-gray-200 font-medium">{showForm ? '新增耗材' : '耗材管理'}</h3>
          <button onClick={showForm ? () => { setShowForm(false); setErr(''); } : onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && !showForm && (
          <div className="space-y-3">
            <button onClick={() => setShowForm(true)} className="text-[10px] px-3 py-1.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 self-start">+ 新增耗材</button>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
              <div className="text-[9px] text-gray-500 mb-1">耗材总支出</div>
              <div className="text-lg font-bold text-yellow-400">¥{total.toLocaleString()}</div>
            </div>
            <div className="flex-1 overflow-auto space-y-1 max-h-48">
              {records.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500">暂无耗材记录</div>
              ) : (
                records.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between bg-gray-900/30 rounded px-3 py-2 border border-gray-700/20">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-300 truncate">{r.material_desc || r.category || '耗材'}</div>
                      <div className="text-[9px] text-gray-600">
                        {r.project_name ? `${r.project_name} · ` : ''}{r.created_at?.slice(0, 10) || ''}
                      </div>
                    </div>
                    <span className="text-xs text-red-400 shrink-0 ml-2">¥{Number(r.amount || 0).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!loading && showForm && (
          <div className="space-y-3 flex-1 overflow-auto min-h-0">
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">项目</label>
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500">
                <option value="">选择项目（可选）</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">耗材描述 *</label>
              <input value={form.material_desc} onChange={e => setForm(f => ({ ...f, material_desc: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" placeholder="如：水泥、钢筋..." />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">金额 *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" placeholder="0.00" />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-500 block mb-1">供应商</label>
                <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">日期</label>
              <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 block mb-1">备注</label>
              <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} rows={2}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 text-[10px] px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                {submitting ? '提交中...' : '提交'}
              </button>
              <button onClick={() => { setShowForm(false); setErr(''); }}
                className="text-[10px] px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 考勤查看模态框 */
function AttendanceViewModal({ onClose, cloudApi }: { onClose: () => void; cloudApi: Props['cloudApi'] }) {
  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      cloudApi('/api/v1/tenant-admin/attendance/summary').then(d => setSummary(d?.data)),
      cloudApi('/api/v1/tenant-admin/attendance-all').then(d => setRecords(d?.data || [])),
    ])
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">⏰</span>
          <h3 className="text-sm text-gray-200 font-medium">考勤记录</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && !err && (
          <div className="space-y-3">
            {/* 汇总卡片 */}
            {summary && (
              <>
                <div className="text-center text-[10px] text-gray-500">📅 {summary.date}</div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
                    <div className="text-lg font-bold text-blue-400">{summary.checked_in_count || 0}</div>
                    <div className="text-[9px] text-gray-500">已上班</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
                    <div className="text-lg font-bold text-green-400">{summary.checked_out_count || 0}</div>
                    <div className="text-[9px] text-gray-500">已下班</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
                    <div className="text-lg font-bold text-orange-400">{summary.working || 0}</div>
                    <div className="text-[9px] text-gray-500">在岗中</div>
                  </div>
                </div>
              </>
            )}

            {/* 明细列表 */}
            <div className={summary ? 'border-t border-gray-700/30 pt-2' : ''}>
              <div className="text-[9px] text-gray-500 mb-2">📋 最近打卡记录</div>
              <div className="max-h-48 overflow-auto space-y-1">
                {records.length === 0 ? (
                  <div className="text-center py-3 text-[10px] text-gray-600">暂无记录</div>
                ) : (
                  records.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between bg-gray-900/30 rounded px-2.5 py-1.5 border border-gray-700/20">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-gray-300">{r.user_name || `用户#${r.user_id}`}</span>
                        <span className={`ml-2 text-[9px] ${r.type === 'check_in' ? 'text-blue-400' : 'text-green-400'}`}>
                          {r.type === 'check_in' ? '上班' : '下班'}
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-600 shrink-0 ml-2">
                        {r.check_time?.slice(5, 16) || ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 项目经理看板：项目进度、质量看板、耗材统计、支出记录 */
export function ProjectManagerDashboard({ cloudApi }: Props) {
  const [projects, setProjects] = useState<any[]>([]);
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showExpenses, setShowExpenses] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showAttendanceView, setShowAttendanceView] = useState(false);
  const projectsRef = useRef<HTMLDivElement>(null);

  const scrollToProjects = () => {
    projectsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const handleModuleClick = (label: string, id: string) => {
    if (id === 'expenses') { setShowExpenses(true); return; }
    if (id === 'suppliers') { setShowSuppliers(true); return; }
    if (id === 'quality') { setShowQuality(true); return; }
    if (id === 'materials') { setShowMaterials(true); return; }
    if (id === 'attendance') { setShowAttendanceView(true); return; }
    if (id === 'progress') { scrollToProjects(); return; }
    showToast(`${label} — 功能开发中`);
  };

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
        <div ref={projectsRef}>
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-gray-200 text-xs px-4 py-2 rounded-lg border border-gray-600 shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* 支出记录模态框 */}
      {showExpenses && (
        <FinanceModal
          onClose={() => setShowExpenses(false)}
          cloudApi={cloudApi}
        />
      )}

      {/* 供应商模态框 */}
      {showSuppliers && (
        <SupplierModal
          onClose={() => setShowSuppliers(false)}
          cloudApi={cloudApi}
        />
      )}

      {/* 质量看板模态框 */}
      {showQuality && (
        <QualityModal
          onClose={() => setShowQuality(false)}
          cloudApi={cloudApi}
        />
      )}

      {/* 耗材管理模态框 */}
      {showMaterials && (
        <MaterialsModal
          onClose={() => setShowMaterials(false)}
          cloudApi={cloudApi}
        />
      )}

      {/* 考勤查看模态框 */}
      {showAttendanceView && (
        <AttendanceViewModal
          onClose={() => setShowAttendanceView(false)}
          cloudApi={cloudApi}
        />
      )}
    </div>
  );
}
