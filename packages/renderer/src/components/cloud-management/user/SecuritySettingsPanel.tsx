import { useState, useEffect } from 'react';
import type { SecuritySettings } from '@codepilot/core';

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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-green-500' : 'bg-white/10'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 mr-4">
        <p className="text-sm text-cp-text">{title}</p>
        {description && <p className="text-[11px] text-cp-text-dim/50 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SecuritySettingsPanel() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [show2FADialog, setShow2FADialog] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.cloudManagement.user.getSecuritySettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load security settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: keyof SecuritySettings, value: any) => {
    if (!settings) return;
    try {
      const updated = await window.electronAPI.cloudManagement.user.updateSecuritySettings({
        [key]: value,
      });
      setSettings(updated);
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cp-accent" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <p className="text-sm text-cp-text-dim">无法加载安全设置</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="安全设置" />
      
      <Card>
        <div className="space-y-1">
          <SettingRow
            title="两步验证"
            description="使用验证器应用、短信或邮箱进行两步验证"
          >
            <Toggle
              checked={settings.twoFactorEnabled}
              onChange={() => setShow2FADialog(true)}
            />
          </SettingRow>

          <SettingRow
            title="登录通知"
            description="新设备登录时发送邮件通知"
          >
            <Toggle
              checked={settings.loginNotification}
              onChange={(v) => handleUpdateSetting('loginNotification', v)}
            />
          </SettingRow>

          <SettingRow
            title="会话超时"
            description="无操作自动退出时间（分钟）"
          >
            <select
              value={settings.sessionTimeout}
              onChange={(e) => handleUpdateSetting('sessionTimeout', Number(e.target.value))}
              className="px-3 py-1.5 bg-white/5 border border-cp-border/40 rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-accent"
            >
              <option value={30}>30分钟</option>
              <option value={60}>1小时</option>
              <option value={120}>2小时</option>
              <option value={480}>8小时</option>
            </select>
          </SettingRow>
        </div>
      </Card>

      <Card>
        <h4 className="text-sm font-medium text-cp-text mb-3">受信任设备</h4>
        <p className="text-xs text-cp-text-dim mb-3">
          {settings.trustedDevices.length} 台设备已信任
        </p>
        <button
          onClick={async () => {
            if (confirm('确定要注销所有设备吗？')) {
              await window.electronAPI.cloudManagement.user.logoutAllDevices();
              loadSettings();
            }
          }}
          className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:underline"
        >
          注销所有设备
        </button>
      </Card>

      {show2FADialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <h3 className="text-lg font-medium text-cp-text mb-4">启用两步验证</h3>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  await window.electronAPI.cloudManagement.user.enableTwoFactor({ method: 'authenticator' });
                  setShow2FADialog(false);
                  loadSettings();
                }}
                className="w-full px-4 py-2 bg-white/5 border border-cp-border/40 rounded-lg text-sm text-cp-text hover:bg-white/10 text-left"
              >
                验证器应用（推荐）
              </button>
              <button
                onClick={async () => {
                  await window.electronAPI.cloudManagement.user.enableTwoFactor({ method: 'sms' });
                  setShow2FADialog(false);
                  loadSettings();
                }}
                className="w-full px-4 py-2 bg-white/5 border border-cp-border/40 rounded-lg text-sm text-cp-text hover:bg-white/10 text-left"
              >
                短信验证
              </button>
              <button
                onClick={async () => {
                  await window.electronAPI.cloudManagement.user.enableTwoFactor({ method: 'email' });
                  setShow2FADialog(false);
                  loadSettings();
                }}
                className="w-full px-4 py-2 bg-white/5 border border-cp-border/40 rounded-lg text-sm text-cp-text hover:bg-white/10 text-left"
              >
                邮箱验证
              </button>
            </div>
            <button
              onClick={() => setShow2FADialog(false)}
              className="mt-4 w-full px-4 py-2 text-sm text-cp-text-dim hover:text-cp-text"
            >
              取消
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}
