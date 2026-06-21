/**
 * 发送文件邮件弹窗
 * 预填附件路径，填写收件人/主题/正文后发送
 */
import { useState, useEffect } from 'react';

interface SendFileDialogProps {
  open: boolean;
  filePath: string;
  fileName?: string;
  onClose: () => void;
  onSent?: () => void;
}

export function SendFileDialog({ open, filePath, fileName, onClose, onSent }: SendFileDialogProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [presets, setPresets] = useState<Array<{ key: string; name: string; description: string }>>([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // 加载预设模板
  useEffect(() => {
    if (!open) return;
    window.electronAPI?.emailService?.getPresetList?.()
      .then((r: any) => {
        if (r?.success && Array.isArray(r.data)) setPresets(r.data);
      })
      .catch(() => {});
  }, [open]);

  // 选择模板后自动填充
  const handlePresetSelect = (key: string) => {
    setSelectedPreset(key === selectedPreset ? '' : key);
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      setStatus('请填写收件人和主题');
      setTimeout(() => setStatus(''), 3000);
      return;
    }
    setSending(true);
    setStatus('');
    try {
      const mailConfig: any = {
        to: to.trim(),
        subject: subject.trim(),
        body: body || '请查收附件文件。',
        attachments: [{ filename: fileName || filePath.split(/[/\\]/).pop() || 'file', path: filePath }],
      };

      let result: any;
      if (selectedPreset) {
        result = await window.electronAPI.emailService.sendWithPreset(selectedPreset, {}, mailConfig);
      } else {
        result = await window.electronAPI.emailService.sendMail(mailConfig);
      }

      if (result?.success) {
        setStatus('✅ 邮件发送成功！');
        if (onSent) setTimeout(onSent, 1500);
        setTimeout(onClose, 2000);
      } else {
        setStatus(`❌ 发送失败: ${result?.error || '未知错误'}`);
      }
    } catch (err: any) {
      setStatus(`❌ 错误: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const displayName = fileName || filePath.split(/[/\\]/).pop() || 'unknown';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-[420px] max-h-[80vh] overflow-y-auto bg-cp-panel border border-cp-border rounded-xl shadow-2xl p-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-cp-text">通过邮件发送文件</h3>
            <button
              onClick={onClose}
              className="text-cp-text-dim hover:text-cp-text text-lg leading-none px-1"
            >
              ✕
            </button>
          </div>

          {/* 附件信息 */}
          <div className="bg-black/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-sm">📎</span>
            <span className="text-xs text-cp-text-dim truncate flex-1" title={filePath}>
              {displayName}
            </span>
            <span className="text-[10px] text-cp-text-dim/40">{filePath}</span>
          </div>

          {/* 模板选择 */}
          {presets.length > 0 && (
            <div>
              <label className="text-[11px] text-cp-text-dim/70 block mb-1.5">邮件模板 (可选)</label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePresetSelect(p.key)}
                    className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${
                      selectedPreset === p.key
                        ? 'bg-cp-accent/20 text-cp-accent border border-cp-accent/30'
                        : 'border border-cp-border/40 text-cp-text-dim hover:text-cp-text hover:border-cp-border'
                    }`}
                    title={p.description}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 收件人 */}
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">收件人 *</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); }}}
            />
          </div>

          {/* 主题 */}
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">主题 *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`关于: ${displayName}`}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>

          {/* 正文 */}
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">正文</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="邮件正文..."
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent resize-none"
            />
          </div>

          {/* 按钮 */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSend}
              disabled={sending || !to.trim() || !subject.trim()}
              className="text-xs px-4 py-1.5 rounded-md bg-cp-accent text-cp-text hover:bg-cp-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? '发送中...' : '发送邮件'}
            </button>
            <button
              onClick={onClose}
              className="text-xs px-4 py-1.5 rounded-md border border-cp-border/50 text-cp-text-dim hover:text-cp-text transition-colors"
            >
              取消
            </button>
          </div>

          {/* 状态 */}
          {status && (
            <div className={`text-xs px-3 py-2 rounded-lg ${
              status.includes('✅') ? 'bg-green-500/10 text-green-400' :
              status.includes('❌') ? 'bg-red-500/10 text-red-400' :
              'bg-blue-500/10 text-blue-400'
            }`}>
              {status}
            </div>
          )}

          {/* 提示 */}
          <div className="text-[10px] text-cp-text-dim/40 bg-black/10 rounded-lg px-3 py-2">
            <p>首次使用请先在「设置 → 邮件」中配置 SMTP 服务器</p>
          </div>
        </div>
      </div>
    </>
  );
}
