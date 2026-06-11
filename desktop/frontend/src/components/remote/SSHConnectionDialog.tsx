import { useState, useEffect } from 'react';
import { useRemoteStore, SSHConnection, SSHConnectionForm } from '../../stores/remote-store';

interface Props {
  connection: SSHConnection | null;
  onClose: () => void;
}

export function SSHConnectionDialog({ connection, onClose }: Props) {
  const { saveConnection, testConnection } = useRemoteStore();
  
  const [form, setForm] = useState<SSHConnectionForm>({
    name: '',
    host: '',
    port: 22,
    username: '',
    authMethod: 'password',
    password: '',
    privateKey: '',
  });
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (connection) {
      setForm({
        id: connection.id,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authMethod: connection.authMethod,
        password: '',
        privateKey: '',
      });
    }
  }, [connection]);

  const handleChange = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!form.host || !form.username) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testConnection(form);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.host || !form.username) return;
    if (form.authMethod === 'password' && !form.password && !connection) return;
    
    setSaving(true);
    try {
      await saveConnection(form);
      onClose();
    } catch (err: any) {
      console.error('Failed to save connection:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="w-[500px] max-w-[90vw] bg-cp-panel border border-cp-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-cp-border">
          <h2 className="text-cp-text font-semibold">
            {connection ? '编辑连接' : '添加 SSH 连接'}
          </h2>
          <button
            onClick={onClose}
            className="text-cp-text-dim hover:text-white text-xl transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Connection Name */}
          <div>
            <label className="block text-xs text-cp-text-dim mb-1">连接名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例如：生产服务器"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>

          {/* Host */}
          <div>
            <label className="block text-xs text-cp-text-dim mb-1">主机地址</label>
            <input
              type="text"
              value={form.host}
              onChange={(e) => handleChange('host', e.target.value)}
              placeholder="192.168.1.100 或 example.com"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>

          {/* Port & Username */}
          <div className="flex gap-3">
            <div className="w-24">
              <label className="block text-xs text-cp-text-dim mb-1">端口</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => handleChange('port', parseInt(e.target.value) || 22)}
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-cp-text-dim mb-1">用户名</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="root"
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent"
              />
            </div>
          </div>

          {/* Auth Method */}
          <div>
            <label className="block text-xs text-cp-text-dim mb-2">认证方式</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={form.authMethod === 'password'}
                  onChange={() => handleChange('authMethod', 'password')}
                  className="accent-cp-accent"
                />
                <span className="text-sm text-cp-text">密码</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={form.authMethod === 'privateKey'}
                  onChange={() => handleChange('authMethod', 'privateKey')}
                  className="accent-cp-accent"
                />
                <span className="text-sm text-cp-text">私钥</span>
              </label>
            </div>
          </div>

          {/* Password or Private Key */}
          {form.authMethod === 'password' ? (
            <div>
              <label className="block text-xs text-cp-text-dim mb-1">密码</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="SSH 密码"
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-cp-text-dim mb-1">私钥内容</label>
              <textarea
                value={form.privateKey}
                onChange={(e) => handleChange('privateKey', e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                rows={5}
                className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-2 text-sm text-cp-text outline-none focus:border-cp-accent resize-none font-mono"
              />
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={`text-xs p-3 rounded ${
              testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {testResult.success ? '✓ 连接测试成功' : `✗ ${testResult.error}`}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-cp-border flex items-center justify-between">
          <button
            onClick={handleTest}
            disabled={testing || !form.host || !form.username}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-cp-text-dim hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded text-cp-text-dim hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.host || !form.username}
              className="text-xs px-4 py-1.5 rounded bg-cp-accent text-white hover:bg-cp-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
