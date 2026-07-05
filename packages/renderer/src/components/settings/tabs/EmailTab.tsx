import { useState, useEffect } from 'react';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
}

interface PresetInfo {
  key: string;
  name: string;
  description: string;
}

interface MailConfig {
  to: string;
  subject: string;
  body: string;
  html?: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{ filename: string; path?: string; content?: string }>;
}

const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: '',
  port: 465,
  secure: true,
  user: '',
  pass: '',
  fromName: '灵境AIIDE',
};

export function EmailTab() {
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(DEFAULT_SMTP_CONFIG);
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);

  // 邮件发送表单
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // 预设模板的占位符值
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPresets();
    loadSavedConfig();
  }, []);

  const loadSavedConfig = async () => {
    try {
      if (window.electronAPI?.emailService?.getConfig) {
        const result = await window.electronAPI.emailService.getConfig();
        if (result?.success && result?.data) {
          setSmtpConfig((prev) => ({ ...prev, ...result.data }));
        }
      }
    } catch (err: any) {
      console.error('[EmailTab] Failed to load saved config:', err);
    }
  };

  const loadPresets = async () => {
    try {
      if (window.electronAPI?.emailService?.getPresetList) {
        const result = await window.electronAPI.emailService.getPresetList();
        if (result?.data) {
          setPresets(result.data);
        }
      }
    } catch (err: any) {
      console.error('[EmailTab] Failed to load presets:', err);
    }
  };

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3000);
  };

  const handleConfigChange = (field: keyof SmtpConfig, value: any) => {
    setSmtpConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleInitSmtp = async () => {
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      showStatus('请填写 SMTP 服务器、用户名和密码');
      return;
    }
    try {
      if (window.electronAPI?.emailService?.initSmtp) {
        const result = await window.electronAPI.emailService.initSmtp(smtpConfig);
        if (result?.success) {
          showStatus('SMTP 配置已保存');
        } else {
          showStatus(`配置失败: ${result?.error || '未知错误'}`);
        }
      }
    } catch (err: any) {
      showStatus(`错误: ${err.message}`);
    }
  };

  const handleValidateConfig = async () => {
    setTesting(true);
    try {
      if (window.electronAPI?.emailService?.validateConfig) {
        const result = await window.electronAPI.emailService.validateConfig(smtpConfig);
        if (result?.valid) {
          showStatus('SMTP 配置验证成功！');
        } else {
          showStatus(`验证失败: ${result?.error || '未知错误'}`);
        }
      }
    } catch (err: any) {
      showStatus(`验证错误: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSendMail = async () => {
    if (!to || !subject || !body) {
      showStatus('请填写收件人、主题和正文');
      return;
    }
    setSending(true);
    try {
      const mailConfig: MailConfig = { to, subject, body };

      if (selectedPreset) {
        // 使用预设模板发送
        if (window.electronAPI?.emailService?.sendWithPreset) {
          const result = await window.electronAPI.emailService.sendWithPreset(
            selectedPreset,
            placeholders,
            { ...mailConfig }
          );
          if (result?.success) {
            showStatus('邮件发送成功！');
            setTo('');
            setSubject('');
            setBody('');
          } else {
            showStatus(`发送失败: ${result?.error || '未知错误'}`);
          }
        }
      } else {
        // 直接发送
        if (window.electronAPI?.emailService?.sendMail) {
          const result = await window.electronAPI.emailService.sendMail(mailConfig);
          if (result?.success) {
            showStatus('邮件发送成功！');
            setTo('');
            setSubject('');
            setBody('');
          } else {
            showStatus(`发送失败: ${result?.error || '未知错误'}`);
          }
        }
      }
    } catch (err: any) {
      showStatus(`发送错误: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    setSelectedPreset(presetKey === selectedPreset ? '' : presetKey);
    if (presetKey !== selectedPreset) {
      setPlaceholders({});
    }
  };

  return (
    <div className="space-y-6">
      {/* SMTP 服务器配置 */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-cp-text">SMTP 服务器配置</h3>
        <p className="text-[11px] text-cp-text-dim/60">
          配置 SMTP 服务器以发送邮件。支持 QQ邮箱、163邮箱、Gmail 等。
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">SMTP 服务器地址</label>
            <input
              type="text"
              value={smtpConfig.host}
              onChange={(e) => handleConfigChange('host', e.target.value)}
              placeholder="smtp.qq.com"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">端口</label>
            <input
              type="number"
              value={smtpConfig.port}
              onChange={(e) => handleConfigChange('port', parseInt(e.target.value) || 465)}
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">用户名 (邮箱地址)</label>
            <input
              type="email"
              value={smtpConfig.user}
              onChange={(e) => handleConfigChange('user', e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">密码/授权码</label>
            <input
              type="password"
              value={smtpConfig.pass}
              onChange={(e) => handleConfigChange('pass', e.target.value)}
              placeholder="授权码或密码"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">发件人名称</label>
            <input
              type="text"
              value={smtpConfig.fromName}
              onChange={(e) => handleConfigChange('fromName', e.target.value)}
              placeholder="灵境AIIDE"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 pt-1.5">
              <input
                type="checkbox"
                checked={smtpConfig.secure}
                onChange={(e) => handleConfigChange('secure', e.target.checked)}
                className="rounded bg-cp-bg border-cp-border/50"
              />
              <span className="text-[11px] text-cp-text-dim">使用 SSL/TLS</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleInitSmtp}
            className="text-xs px-4 py-1.5 rounded-md bg-cp-accent/20 text-cp-accent hover:bg-cp-accent/30 transition-colors"
          >
            保存配置
          </button>
          <button
            onClick={handleValidateConfig}
            disabled={testing || !smtpConfig.host}
            className="text-xs px-4 py-1.5 rounded-md border border-cp-border/50 text-cp-text-dim hover:text-cp-text hover:border-cp-border disabled:opacity-50 transition-colors"
          >
            {testing ? '验证中...' : '测试连接'}
          </button>
        </div>

        <div className="text-[10px] text-cp-text-dim/40 bg-black/10 rounded-lg p-3 space-y-1">
          <p className="font-medium text-cp-text-dim/60 mb-1">常见 SMTP 配置：</p>
          <p>QQ邮箱: smtp.qq.com, 端口 465 (SSL), 需开启SMTP服务并使用授权码</p>
          <p>163邮箱: smtp.163.com, 端口 465 (SSL), 需开启SMTP服务并使用授权码</p>
          <p>Gmail: smtp.gmail.com, 端口 465 (SSL), 需开启两步验证并使用应用专用密码</p>
        </div>
      </div>

      {/* 发送邮件 */}
      <div className="bg-white/[0.03] border border-cp-border/40 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-cp-text">发送邮件</h3>

        {/* 预设模板选择 */}
        {presets.length > 0 && (
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">邮件模板 (可选)</label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetSelect(preset.key)}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                    selectedPreset === preset.key
                      ? 'bg-cp-accent/20 text-cp-accent border border-cp-accent/30'
                      : 'border border-cp-border/40 text-cp-text-dim hover:text-cp-text hover:border-cp-border'
                  }`}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">收件人</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@email.com"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">主题</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="邮件主题"
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-cp-text-dim/70 block mb-1">正文</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="邮件正文内容..."
              className="w-full bg-cp-bg border border-cp-border/50 rounded-lg px-3 py-1.5 text-sm text-cp-text outline-none focus:border-cp-accent resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSendMail}
            disabled={sending || !to || !subject || !body}
            className="text-xs px-4 py-1.5 rounded-md bg-cp-accent text-cp-text hover:bg-cp-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? '发送中...' : selectedPreset ? '使用模板发送' : '发送邮件'}
          </button>
        </div>
      </div>

      {/* 状态提示 */}
      {status && (
        <div className={`text-xs px-4 py-2 rounded-lg ${
          status.includes('成功') ? 'bg-green-500/10 text-green-400' :
          status.includes('失败') || status.includes('错误') ? 'bg-red-500/10 text-red-400' :
          'bg-blue-500/10 text-blue-400'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}
