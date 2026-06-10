import React, { useState, useEffect, useCallback } from 'react';

interface WebhookConfig {
  channel: string;
  slack?: string;
  discord?: string;
  github?: { owner: string; repo: string; token: string; event_type?: string };
  url?: string;
  headers?: Record<string, string>;
  slackText?: string;
}

interface WebhookLog {
  id: string;
  channel: string;
  payload: string;
  received_at: string;
}

interface Props {
  cloudAdminApi: (endpoint: string, method?: string, body?: unknown) => Promise<any>;
}

const EMPTY_FORM: WebhookConfig = { channel: '' };

export function WebhookTab({ cloudAdminApi }: Props) {
  const [webhooks, setWebhooks] = useState<Record<string, WebhookConfig>>({});
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WebhookConfig>({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string>('');
  const [testPayload, setTestPayload] = useState('{"test": true, "msg": "webhook test"}');

  const loadWebhooks = useCallback(async () => {
    try {
      const result = await cloudAdminApi('/webhook-config', 'GET');
      if (result && typeof result === 'object') setWebhooks(result);
    } catch { /* no auth */ }
    setLoading(false);
  }, [cloudAdminApi]);

  const loadLogs = useCallback(async () => {
    try {
      const result = await cloudAdminApi('/admin/webhooks', 'GET');
      if (result?.logs) setLogs(result.logs);
    } catch { /* no auth */ }
  }, [cloudAdminApi]);

  useEffect(() => {
    loadWebhooks();
    loadLogs();
  }, [loadWebhooks, loadLogs]);

  const handleEdit = (channel: string) => {
    const cfg = webhooks[channel] || { channel };
    setEditing({ ...cfg, channel });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditing({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editing.channel.trim()) return;
    try {
      await cloudAdminApi('/webhook-config', 'POST', editing);
      setShowForm(false);
      await loadWebhooks();
    } catch (err: any) {
      alert('保存失败: ' + (err.message || '未知错误'));
    }
  };

  const handleDelete = async (channel: string) => {
    if (!confirm(`确定删除 webhook "${channel}"？`)) return;
    try {
      await cloudAdminApi('/webhook-config', 'POST', { channel,
        slack: null, discord: null, github: null, url: null, headers: null, slackText: null });
      await loadWebhooks();
    } catch (err: any) {
      alert('删除失败: ' + (err.message || '未知错误'));
    }
  };

  const handleTest = async (channel: string) => {
    try {
      const payload = JSON.parse(testPayload);
      const result = await cloudAdminApi(`/webhook/${encodeURIComponent(channel)}`, 'POST', payload);
      setTestResult(`✅ 发送成功: ${JSON.stringify(result)}`);
      await loadLogs();
    } catch (err: any) {
      setTestResult(`❌ 失败: ${err.message || String(err)}`);
    }
  };

  const channels = Object.keys(webhooks);

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">加载中...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-200">Webhook 配置管理</h2>
        <button
          onClick={handleNew}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
        >
          + 新建 Webhook
        </button>
      </div>

      {/* Webhook List */}
      <div className="space-y-2">
        {channels.length === 0 && (
          <p className="text-xs text-gray-500 py-4">暂无 webhook 配置，点击「新建」添加</p>
        )}
        {channels.map(ch => {
          const cfg = webhooks[ch];
          return (
            <div
              key={ch}
              className={`bg-gray-800/50 border rounded-lg p-3 cursor-pointer transition-colors ${
                selectedChannel === ch ? 'border-blue-500/50 bg-gray-800' : 'border-gray-700/50 hover:border-gray-600'
              }`}
              onClick={() => setSelectedChannel(selectedChannel === ch ? null : ch)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-200 font-mono">{ch}</span>
                  <span className="ml-2 text-[10px] text-gray-500">
                    {[cfg.slack && 'Slack', cfg.discord && 'Discord', cfg.github && 'GitHub', cfg.url && 'HTTP']
                      .filter(Boolean).join(', ') || '未配置转发'}
                  </span>
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(ch); }}
                    className="text-[10px] px-2 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                  >编辑</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(ch); }}
                    className="text-[10px] px-2 py-1 rounded text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >删除</button>
                </div>
              </div>

              {/* Expanded detail */}
              {selectedChannel === ch && (
                <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-3">
                  {/* Test webhook */}
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">测试 Payload (JSON)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={testPayload}
                        onChange={e => setTestPayload(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 font-mono"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTest(ch); }}
                        className="text-[10px] px-3 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30"
                      >触发测试</button>
                    </div>
                    {testResult && <p className="text-[10px] mt-1 text-gray-400">{testResult}</p>}
                  </div>

                  {/* Config summary */}
                  {cfg.slack && <p className="text-[10px] text-gray-500">Slack: {cfg.slack.slice(0, 60)}...</p>}
                  {cfg.discord && <p className="text-[10px] text-gray-500">Discord: {cfg.discord.slice(0, 60)}...</p>}
                  {cfg.github && <p className="text-[10px] text-gray-500">GitHub: {cfg.github.owner}/{cfg.github.repo}</p>}
                  {cfg.url && <p className="text-[10px] text-gray-500">HTTP: {cfg.url}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Logs */}
      <div>
        <h3 className="text-xs font-medium text-gray-400 mb-2">最近推送日志</h3>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {logs.length === 0 && <p className="text-[10px] text-gray-600">暂无日志</p>}
          {logs.map(log => (
            <div key={log.id} className="text-[10px] text-gray-500 bg-gray-800/30 rounded px-2 py-1 font-mono">
              <span className="text-gray-400">{log.received_at?.slice(0, 19) || '-'}</span>
              <span className="mx-1 text-blue-400">{log.channel}</span>
              <span className="text-gray-600">{log.payload?.slice(0, 80) || '-'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div
            className="bg-gray-800 rounded-xl p-5 border border-gray-700 w-full max-w-md mx-3 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm text-gray-200 font-medium mb-4">
              {webhooks[editing.channel] ? '编辑 Webhook' : '新建 Webhook'}
            </h3>

            <div className="space-y-3">
              {/* Channel */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Channel 名称</label>
                <input
                  type="text"
                  value={editing.channel}
                  onChange={e => setEditing({ ...editing, channel: e.target.value })}
                  disabled={!!webhooks[editing.channel]}
                  placeholder="例如: deployment, alert, ci"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 disabled:opacity-50"
                />
              </div>

              {/* Slack */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Slack Webhook URL</label>
                <input
                  type="text"
                  value={editing.slack || ''}
                  onChange={e => setEditing({ ...editing, slack: e.target.value || undefined })}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
                />
              </div>

              {/* Discord */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Discord Webhook URL</label>
                <input
                  type="text"
                  value={editing.discord || ''}
                  onChange={e => setEditing({ ...editing, discord: e.target.value || undefined })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
                />
              </div>

              {/* HTTP URL */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">HTTP 转发 URL</label>
                <input
                  type="text"
                  value={editing.url || ''}
                  onChange={e => setEditing({ ...editing, url: e.target.value || undefined })}
                  placeholder="https://your-server.com/webhook"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
                />
              </div>

              {/* GitHub */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 block">GitHub Repository Dispatch</label>
                <input
                  type="text"
                  value={editing.github?.owner || ''}
                  onChange={e => setEditing({ ...editing, github: { ...editing.github, owner: e.target.value, repo: editing.github?.repo || '', token: editing.github?.token || '' } })}
                  placeholder="Owner"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
                />
                <input
                  type="text"
                  value={editing.github?.repo || ''}
                  onChange={e => setEditing({ ...editing, github: { ...editing.github, owner: editing.github?.owner || '', repo: e.target.value, token: editing.github?.token || '' } })}
                  placeholder="Repo"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
                />
                <input
                  type="password"
                  value={editing.github?.token || ''}
                  onChange={e => setEditing({ ...editing, github: { ...editing.github, owner: editing.github?.owner || '', repo: editing.github?.repo || '', token: e.target.value } })}
                  placeholder="Personal Access Token"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} className="flex-1 text-xs px-3 py-2 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30">
                保存
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 text-xs px-3 py-2 rounded-md bg-gray-700/30 text-gray-400 hover:bg-gray-700/50">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
