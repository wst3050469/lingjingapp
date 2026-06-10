import React, { useState, useEffect } from 'react';
import type { QuickModule } from './types';

interface Props {
  cloudApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
}

/** 考勤统计模态框 */
function AttendanceModal({
  onClose,
  cloudApi,
  userId,
}: {
  onClose: () => void;
  cloudApi: Props['cloudApi'];
  userId: string;
}) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [stats, setStats] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    setErr('');
    try {
      const [statsRes, recordsRes] = await Promise.all([
        cloudApi(`/api/attendance/stats/${userId}?month=${month}`).catch(() => null),
        cloudApi(`/api/attendance/records/${userId}?month=${month}`).catch(() => null),
      ]);
      if (statsRes) setStats(statsRes);
      if (recordsRes?.records) setRecords(recordsRes.records);
    } catch (e: any) {
      setErr(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    if (m === 1) setMonth(`${y - 1}-12`);
    else setMonth(`${y}-${String(m - 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    if (m === 12) setMonth(`${y + 1}-01`);
    else setMonth(`${y}-${String(m + 1).padStart(2, '0')}`);
  };

  /* 按天分组 */
  const dayMap = new Map<string, { checkIn?: string; checkOut?: string }>();
  for (const r of records) {
    const d = new Date(r.check_time).toLocaleDateString('zh-CN');
    if (r.type === 'check_in') {
      dayMap.set(d, { ...(dayMap.get(d) || {}), checkIn: new Date(r.check_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
    } else {
      dayMap.set(d, { ...(dayMap.get(d) || {}), checkOut: new Date(r.check_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
    }
  }
  const dayEntries = Array.from(dayMap.entries()).reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">📅</span>
          <h3 className="text-sm text-gray-200 font-medium">我的考勤</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {/* 月份切换 */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <button onClick={prevMonth} className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1">◀</button>
          <span className="text-xs text-gray-200 font-medium">{month}</span>
          <button onClick={nextMonth} className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1">▶</button>
        </div>

        {err && <p className="text-[10px] text-red-400 mb-2 text-center shrink-0">{err}</p>}

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
            <div className="bg-gray-900/50 rounded-lg p-2 text-center border border-gray-700/30">
              <div className="text-lg font-bold text-blue-400">{stats.days || 0}</div>
              <div className="text-[9px] text-gray-500">出勤天数</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2 text-center border border-gray-700/30">
              <div className="text-lg font-bold text-green-400">{stats.check_in_count || 0}</div>
              <div className="text-[9px] text-gray-500">上班打卡</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2 text-center border border-gray-700/30">
              <div className="text-lg font-bold text-orange-400">{stats.check_out_count || 0}</div>
              <div className="text-[9px] text-gray-500">下班打卡</div>
            </div>
          </div>
        )}

        {/* 记录列表 */}
        <div className="flex-1 overflow-auto space-y-1 min-h-0">
          {loading ? (
            <div className="text-center py-6">
              <span className="text-xs text-gray-500">加载中...</span>
            </div>
          ) : dayEntries.length === 0 ? (
            <div className="text-center py-6">
              <span className="text-xs text-gray-500">本月暂无打卡记录</span>
            </div>
          ) : (
            dayEntries.map(([day, times]) => (
              <div key={day} className="flex items-center justify-between bg-gray-900/30 rounded px-3 py-2 border border-gray-700/20">
                <span className="text-xs text-gray-300">{day}</span>
                <div className="flex items-center gap-3">
                  {times.checkIn ? (
                    <span className="text-[10px] text-green-400">⬆ {times.checkIn}</span>
                  ) : (
                    <span className="text-[10px] text-gray-600">—</span>
                  )}
                  {times.checkOut ? (
                    <span className="text-[10px] text-orange-400">⬇ {times.checkOut}</span>
                  ) : (
                    <span className="text-[10px] text-gray-600">—</span>
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

/** 打卡签到模态框 */
function CheckInModal({
  onClose,
  cloudApi,
  todayStatus,
  userId,
  onSuccess,
}: {
  onClose: () => void;
  cloudApi: Props['cloudApi'];
  todayStatus: '未打卡' | '已上班' | '已下班';
  userId: string;
  onSuccess: (newStatus: '未打卡' | '已上班' | '已下班') => void;
}) {
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleCheckIn = async () => {
    setLoading(true);
    setErr('');
    try {
      const uid = userId || 'anonymous';
      await cloudApi('/api/attendance/check-in', 'POST', {
        user_id: uid,
        address: location || undefined,
      });
      onSuccess('已上班');
    } catch (e: any) {
      setErr(e.message || '打卡失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    setErr('');
    try {
      const uid = userId || 'anonymous';
      await cloudApi('/api/attendance/check-out', 'POST', {
        user_id: uid,
      });
      onSuccess('已下班');
    } catch (e: any) {
      setErr(e.message || '下班打卡失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-xs mx-3 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📍</span>
          <h3 className="text-sm text-gray-200 font-medium">打卡签到</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        <div className="text-center mb-4">
          <div className="text-3xl font-light text-gray-400 mb-1">
            {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <p className="text-[10px] text-gray-500">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>

        {/* 当前位置（可选） */}
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="打卡位置（可选）"
          disabled={loading}
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50 mb-3"
        />

        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        <div className="flex gap-2">
          {todayStatus === '未打卡' && (
            <button
              onClick={handleCheckIn}
              disabled={loading}
              className="flex-1 text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {loading ? '打卡中...' : '✅ 上班打卡'}
            </button>
          )}
          {todayStatus === '已上班' && (
            <button
              onClick={handleCheckOut}
              disabled={loading}
              className="flex-1 text-xs px-4 py-2 rounded bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {loading ? '打卡中...' : '🏁 下班打卡'}
            </button>
          )}
          {todayStatus === '已下班' && (
            <div className="flex-1 text-center text-xs text-green-400 py-2">
              ✅ 今日已完成打卡
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 工资查询模态框 */
function WageModal({
  onClose,
  cloudApi,
  userId,
}: {
  onClose: () => void;
  cloudApi: Props['cloudApi'];
  userId: string;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    cloudApi(`/api/attendance/wages/${userId}`)
      .then(d => setData(d))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">💰</span>
          <h3 className="text-sm text-gray-200 font-medium">工资查询</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {data && (
          <div className="space-y-4">
            {/* 日薪 + 累计已发 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
                <div className="text-[9px] text-gray-500 mb-1">日薪标准</div>
                <div className="text-lg font-bold text-green-400">
                  ¥{Number(data.daily_wage || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700/30">
                <div className="text-[9px] text-gray-500 mb-1">累计已发</div>
                <div className="text-lg font-bold text-blue-400">
                  ¥{Number(data.total_paid || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* 工资发放记录 */}
            <div>
              <h4 className="text-[10px] text-gray-500 font-medium mb-2">发放记录</h4>
              {data.records?.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-600">暂无发放记录</div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-auto">
                  {data.records.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between bg-gray-900/30 rounded px-3 py-2 border border-gray-700/20">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-300 truncate">
                          {r.project_name || '工资'}
                        </div>
                        <div className="text-[9px] text-gray-600">
                          {r.created_at?.slice(0, 10) || ''} · {r.status === 'approved' ? '已发放' : r.status}
                        </div>
                      </div>
                      <span className="text-xs text-green-400 shrink-0 ml-2">
                        +¥{Number(r.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 备用金申请模态框 */
function FundApplyModal({
  onClose,
  cloudApi,
  userId,
}: {
  onClose: () => void;
  cloudApi: Props['cloudApi'];
  userId: string;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await cloudApi('/api/attendance/fund-apply', 'POST', {
        user_id: userId,
        amount: amt,
        reason: reason || '备用金申请',
      });
      if (res?.code === 0) {
        setResult({ success: true, msg: `✅ 申请成功！¥${amt.toLocaleString()} 备用金待审批` });
      } else {
        setResult({ success: false, msg: res?.msg || '申请失败' });
      }
    } catch (e: any) {
      setResult({ success: false, msg: e.message || '提交失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">💸</span>
          <h3 className="text-sm text-gray-200 font-medium">申请备用金</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {result ? (
          <div className="text-center py-4">
            <p className={`text-xs mb-3 ${result.success ? 'text-green-400' : 'text-red-400'}`}>{result.msg}</p>
            <button onClick={onClose} className="text-xs px-4 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">关闭</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">金额（元）</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="输入申请金额" disabled={loading}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50"
                min={0} step={0.01}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">用途说明</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="说明申请备用金的用途" disabled={loading} rows={2}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 disabled:opacity-50 resize-none" />
            </div>
            <button onClick={handleSubmit} disabled={loading || !amount || parseFloat(amount) <= 0}
              className="w-full text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
              {loading ? '提交中...' : '提交申请'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 我的项目模态框 */
function ProjectModal({
  onClose,
  cloudApi,
  userId,
}: {
  onClose: () => void;
  cloudApi: Props['cloudApi'];
  userId: string;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    cloudApi(`/api/attendance/my-project/${userId}`)
      .then(d => setData(d))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [userId]);

  const proj = data?.project;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🏗️</span>
          <h3 className="text-sm text-gray-200 font-medium">我的项目</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!proj && !loading && !err && (
          <div className="text-center py-6">
            <p className="text-xs text-gray-500">暂未绑定项目</p>
          </div>
        )}

        {proj && (
          <div className="space-y-3">
            {/* 项目名称 + 状态 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200 font-medium">{proj.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded ${
                proj.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                proj.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {proj.status === 'in_progress' ? '进行中' : proj.status === 'completed' ? '已完成' : '未开始'}
              </span>
            </div>

            {/* 进度条 */}
            {proj.progress != null && (
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>项目进度</span>
                  <span>{proj.progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{width: `${proj.progress}%`}} />
                </div>
              </div>
            )}

            {/* 项目信息 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {proj.manager_name && (
                <div className="bg-gray-900/30 rounded p-2">
                  <div className="text-[9px] text-gray-500">项目经理</div>
                  <div className="text-gray-200">{proj.manager_name}</div>
                </div>
              )}
              {proj.customer && (
                <div className="bg-gray-900/30 rounded p-2">
                  <div className="text-[9px] text-gray-500">客户</div>
                  <div className="text-gray-200">{proj.customer}</div>
                </div>
              )}
              {proj.contract_amount > 0 && (
                <div className="bg-gray-900/30 rounded p-2">
                  <div className="text-[9px] text-gray-500">合同金额</div>
                  <div className="text-green-400">¥{proj.contract_amount.toLocaleString()}</div>
                </div>
              )}
              {proj.location && (
                <div className="bg-gray-900/30 rounded p-2">
                  <div className="text-[9px] text-gray-500">地点</div>
                  <div className="text-gray-200 truncate">{proj.location}</div>
                </div>
              )}
            </div>

            {/* 我的角色 */}
            <div className="bg-gray-900/30 rounded p-2 text-xs flex items-center justify-between">
              <span className="text-gray-500">我的角色</span>
              <span className="text-blue-400">{data?.my_role === 'worker' ? '工人' : data?.my_role}</span>
            </div>
            {data?.worker_type && (
              <div className="bg-gray-900/30 rounded p-2 text-xs flex items-center justify-between">
                <span className="text-gray-500">工种</span>
                <span className="text-gray-200">{data.worker_type}</span>
              </div>
            )}
            {data?.daily_wage > 0 && (
              <div className="bg-gray-900/30 rounded p-2 text-xs flex items-center justify-between">
                <span className="text-gray-500">日薪</span>
                <span className="text-green-400">¥{data.daily_wage}/天</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 报工记录模态框 */
function WorkReportModal({
  onClose,
  cloudApi,
  userId,
}: {
  onClose: () => void;
  cloudApi: Props['cloudApi'];
  userId: string;
}) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    // 用考勤记录作为报工记录
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    cloudApi(`/api/attendance/records/${userId}?month=${month}`)
      .then(d => setRecords(d.records || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [userId]);

  /* 按天汇总 */
  const dayMap = new Map<string, { checkIn?: string; checkOut?: string }>();
  for (const r of records) {
    const d = new Date(r.check_time).toLocaleDateString('zh-CN');
    if (r.type === 'check_in') {
      dayMap.set(d, { ...(dayMap.get(d) || {}), checkIn: new Date(r.check_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
    } else {
      dayMap.set(d, { ...(dayMap.get(d) || {}), checkOut: new Date(r.check_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
    }
  }
  const dayEntries = Array.from(dayMap.entries()).reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-sm mx-3 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-xl">📋</span>
          <h3 className="text-sm text-gray-200 font-medium">报工记录</h3>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        {loading && <div className="text-center py-6"><span className="text-xs text-gray-500">加载中...</span></div>}
        {err && <p className="text-[10px] text-red-400 mb-2 text-center">{err}</p>}

        {!loading && dayEntries.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-gray-500">本月暂无报工记录</p>
          </div>
        )}

        <div className="flex-1 overflow-auto space-y-1 min-h-0">
          {dayEntries.map(([day, times]) => (
            <div key={day} className="flex items-center justify-between bg-gray-900/30 rounded px-3 py-2.5 border border-gray-700/20">
              <span className="text-xs text-gray-300">{day}</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-500">上班</span>
                <span className="text-[10px] text-green-400 min-w-[40px] text-right">
                  {times.checkIn || '—'}
                </span>
                <span className="text-[10px] text-gray-500">下班</span>
                <span className="text-[10px] text-orange-400 min-w-[40px] text-right">
                  {times.checkOut || '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 工人看板：打卡状态、出工统计、工资查询 */
export function WorkerDashboard({ cloudApi }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState('');
  const [todayStatus, setTodayStatus] = useState<'未打卡' | '已上班' | '已下班'>('未打卡');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showWage, setShowWage] = useState(false);
  const [showFundApply, setShowFundApply] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [showWorkReport, setShowWorkReport] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  /** 从 cloudApi 响应中提取 data（兼容 {data:...} 和裸返回） */
  const extractData = (res: any) => {
    if (!res) return null;
    return res.data !== undefined ? res.data : res;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // 获取用户资料（含项目绑定信息）
      const profileRes = await cloudApi('/api/v1/user/profile').catch(() => null);
      const profileData = extractData(profileRes);
      const uid = profileData?.user_id || profileRes?.user_id || '';
      setUserId(uid);
      if (profileRes?.tenant_role || profileData?.tenant_role) {
        setProfile(profileRes);
      }

      // 通过认证 token 获取今日打卡状态（用 userId）
      if (uid) {
        const attendanceRes = await cloudApi(`/api/attendance/today/${uid}`).catch(() => null);
        if (attendanceRes?.records?.[0]?.check_in) {
          const hasCheckOut = !!attendanceRes.records[0].check_out;
          setTodayStatus(hasCheckOut ? '已下班' : '已上班');
        }
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInSuccess = (newStatus: '未打卡' | '已上班' | '已下班') => {
    setTodayStatus(newStatus);
    setShowCheckIn(false);
    showToast(newStatus === '已上班' ? '✅ 上班打卡成功' : '✅ 下班打卡成功');
  };

  const quickModules: QuickModule[] = [
    { id: 'clock-in', label: '打卡签到', icon: '📍', description: '上班打卡 / 下班打卡', color: 'text-blue-400' },
    { id: 'my-attendance', label: '我的考勤', icon: '📅', description: '查看出勤记录与统计', color: 'text-green-400' },
    { id: 'my-wage', label: '工资查询', icon: '💰', description: '查看工资与日结记录', color: 'text-yellow-400' },
    { id: 'apply-funds', label: '申请备用金', icon: '💸', description: '申请项目备用金', color: 'text-orange-400' },
    { id: 'my-project', label: '我的项目', icon: '🏗️', description: '当前绑定的项目信息', color: 'text-cyan-400' },
    { id: 'work-report', label: '报工记录', icon: '📋', description: '我的报工与工时统计', color: 'text-purple-400' },
  ];

  const handleModuleClick = (m: QuickModule) => {
    if (m.id === 'clock-in') {
      setShowCheckIn(true);
      return;
    }
    if (m.id === 'my-attendance') {
      if (!userId) { showToast('请先登录'); return; }
      setShowAttendance(true);
      return;
    }
    if (m.id === 'my-wage') {
      if (!userId) { showToast('请先登录'); return; }
      setShowWage(true);
      return;
    }
    if (m.id === 'apply-funds') {
      if (!userId) { showToast('请先登录'); return; }
      setShowFundApply(true);
      return;
    }
    if (m.id === 'my-project') {
      if (!userId) { showToast('请先登录'); return; }
      setShowProject(true);
      return;
    }
    if (m.id === 'work-report') {
      if (!userId) { showToast('请先登录'); return; }
      setShowWorkReport(true);
      return;
    }
    showToast(`${m.label} — 功能开发中`);
  };

  const statusColor = todayStatus === '已下班' ? 'text-green-400' : todayStatus === '已上班' ? 'text-blue-400' : 'text-gray-500';

  if (error && !profile) {
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
      {/* 今日状态卡片 */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 mb-1">
              {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${statusColor}`}>{todayStatus}</span>
              {todayStatus === '未打卡' && (
                <button
                  onClick={() => setShowCheckIn(true)}
                  className="text-[10px] px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                >
                  去打卡
                </button>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-gray-400">
              {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            {profile?.company_name && (
              <p className="text-[9px] text-gray-600 mt-1">{profile.company_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* 快捷功能模块（2列网格） */}
      <div>
        <h3 className="text-xs text-gray-400 font-medium mb-2">快捷功能</h3>
        <div className="grid grid-cols-2 gap-2">
          {quickModules.map(m => (
            <div
              key={m.id}
              onClick={() => handleModuleClick(m)}
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

      {/* 个人信息 */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-3">
        <h3 className="text-xs text-gray-400 font-medium mb-2">个人信息</h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">用户</span>
            <span className="text-gray-200">{profile?.nickname || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">角色</span>
            <span className="text-blue-400">工人</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">公司</span>
            <span className="text-gray-200">{profile?.company_name || '-'}</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-4">
          <span className="text-xs text-gray-500">加载中...</span>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-gray-200 text-xs px-4 py-2 rounded-lg border border-gray-600 shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* 打卡签到模态框 */}
      {showCheckIn && (
        <CheckInModal
          onClose={() => setShowCheckIn(false)}
          cloudApi={cloudApi}
          todayStatus={todayStatus}
          userId={userId}
          onSuccess={handleCheckInSuccess}
        />
      )}

      {/* 考勤统计模态框 */}
      {showAttendance && (
        <AttendanceModal
          onClose={() => setShowAttendance(false)}
          cloudApi={cloudApi}
          userId={userId}
        />
      )}

      {/* 工资查询模态框 */}
      {showWage && (
        <WageModal
          onClose={() => setShowWage(false)}
          cloudApi={cloudApi}
          userId={userId}
        />
      )}

      {/* 备用金申请模态框 */}
      {showFundApply && (
        <FundApplyModal
          onClose={() => setShowFundApply(false)}
          cloudApi={cloudApi}
          userId={userId}
        />
      )}

      {/* 我的项目模态框 */}
      {showProject && (
        <ProjectModal
          onClose={() => setShowProject(false)}
          cloudApi={cloudApi}
          userId={userId}
        />
      )}

      {/* 报工记录模态框 */}
      {showWorkReport && (
        <WorkReportModal
          onClose={() => setShowWorkReport(false)}
          cloudApi={cloudApi}
          userId={userId}
        />
      )}
    </div>
  );
}
