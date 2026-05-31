import React, { useState, useEffect } from 'react';
import type { QuickModule } from './types';

interface Props {
  cloudApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
}

/** 工人看板：打卡状态、出工统计、工资查询 */
export function WorkerDashboard({ cloudApi }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [todayStatus, setTodayStatus] = useState<'未打卡' | '已上班' | '已下班'>('未打卡');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const handleModuleClick = (label: string) => {
    setToast(`${label} — 功能开发中`);
    setTimeout(() => setToast(''), 2000);
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
      if (profileRes?.tenant_role) {
        setProfile(profileRes);
      }

      // 尝试获取今日打卡状态
      const now = new Date().toISOString().slice(0, 10);
      const attendanceRes = await cloudApi(`/api/v1/attendance/today?date=${now}`).catch(() => null);
      if (attendanceRes?.data?.status) {
        setTodayStatus(attendanceRes.data.status);
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const quickModules: QuickModule[] = [
    { id: 'clock-in', label: '打卡签到', icon: '📍', description: '上班打卡 / 下班打卡', color: 'text-blue-400' },
    { id: 'my-attendance', label: '我的考勤', icon: '📅', description: '查看出勤记录与统计', color: 'text-green-400' },
    { id: 'my-wage', label: '工资查询', icon: '💰', description: '查看工资与日结记录', color: 'text-yellow-400' },
    { id: 'apply-funds', label: '申请备用金', icon: '💸', description: '申请项目备用金', color: 'text-orange-400' },
    { id: 'my-project', label: '我的项目', icon: '🏗️', description: '当前绑定的项目信息', color: 'text-cyan-400' },
    { id: 'work-report', label: '报工记录', icon: '📋', description: '我的报工与工时统计', color: 'text-purple-400' },
  ];

  // 模拟今日状态（当API不可用时）
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
                <span className="text-[10px] text-gray-500">— 点击下方"打卡签到"</span>
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
              onClick={() => handleModuleClick(m.label)}
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
    </div>
  );
}
