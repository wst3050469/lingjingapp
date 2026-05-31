import React, { useState, useEffect } from 'react';
import type { QuickModule } from './types';

interface Props {
  cloudApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
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

/** 工人看板：打卡状态、出工统计、工资查询 */
export function WorkerDashboard({ cloudApi }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState('');
  const [todayStatus, setTodayStatus] = useState<'未打卡' | '已上班' | '已下班'>('未打卡');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showCheckIn, setShowCheckIn] = useState(false);

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
    </div>
  );
}
