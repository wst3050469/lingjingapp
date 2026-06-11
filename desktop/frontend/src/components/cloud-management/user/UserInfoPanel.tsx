import { useState, useEffect } from 'react';
import type { UserInfo } from '@codepilot/core';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-xs font-medium text-cp-text-dim/70 uppercase tracking-wider">{title}</h4>
      <div className="flex-1 h-px bg-cp-border/20" />
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.03] border border-cp-border/40 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cp-accent" />
    </div>
  );
}

export function UserInfoPanel() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '' });

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      const info = await window.electronAPI.cloudManagement.user.getInfo();
      setUserInfo(info);
      setFormData({ username: info.username, email: info.email });
    } catch (error) {
      console.error('Failed to load user info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await window.electronAPI.cloudManagement.user.update(formData);
      setUserInfo(updated);
      setEditing(false);
    } catch (error) {
      console.error('Failed to update user info:', error);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!userInfo) {
    return (
      <Card>
        <p className="text-sm text-cp-text-dim">无法加载用户信息</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="基本信息" />
      
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-cp-accent/20 flex items-center justify-center text-2xl">
            {userInfo.avatar ? (
              <img src={userInfo.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span>{userInfo.username[0].toUpperCase()}</span>
            )}
          </div>
          
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-cp-border/40 rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-accent"
                  placeholder="用户名"
                />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-cp-border/40 rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-accent"
                  placeholder="邮箱"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-1.5 bg-cp-accent text-white rounded-lg text-sm hover:bg-cp-accent/90"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-1.5 bg-white/5 text-cp-text rounded-lg text-sm hover:bg-white/10"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-cp-text">{userInfo.username}</h3>
                <p className="text-sm text-cp-text-dim">{userInfo.email}</p>
                <button
                  onClick={() => setEditing(true)}
                  className="mt-2 px-3 py-1 text-xs text-cp-accent hover:underline"
                >
                  编辑资料
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-cp-border/20 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-cp-text-dim">注册时间</p>
            <p className="text-cp-text mt-1">{new Date(userInfo.registeredAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-cp-text-dim">最后登录</p>
            <p className="text-cp-text mt-1">
              {userInfo.lastLoginAt ? new Date(userInfo.lastLoginAt).toLocaleString() : '从未登录'}
            </p>
          </div>
          <div>
            <p className="text-cp-text-dim">密码强度</p>
            <p className={`mt-1 ${userInfo.passwordStrength === 'strong' ? 'text-green-500' : userInfo.passwordStrength === 'medium' ? 'text-yellow-500' : 'text-red-500'}`}>
              {userInfo.passwordStrength === 'strong' ? '强' : userInfo.passwordStrength === 'medium' ? '中' : '弱'}
            </p>
          </div>
          <div>
            <p className="text-cp-text-dim">两步验证</p>
            <p className={`mt-1 ${userInfo.twoFactorEnabled ? 'text-green-500' : 'text-cp-text-dim'}`}>
              {userInfo.twoFactorEnabled ? '已启用' : '未启用'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
