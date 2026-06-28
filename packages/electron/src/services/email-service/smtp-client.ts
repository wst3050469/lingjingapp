/**
 * SMTP 邮件客户端与模板管理
 * 
 * nodemailer 通过动态 import 懒加载，未安装时提供友好报错
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
}

export interface MailConfig {
  to: string;
  subject: string;
  body: string;
  html?: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string;
  }>;
}

export interface PresetTemplate {
  key: string;
  name: string;
  description: string;
  subjectTemplate: string;
  bodyTemplate: string;
  placeholders: string[];
}

// 预设首发/收发邮件模板
const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    key: 'preset_first_contact',
    name: '首发联系',
    description: '首次联系目标用户/项目方',
    subjectTemplate: '来自灵境IDE：{{projectName}} 项目协作邀请',
    bodyTemplate: `您好 {{recipientName}}，

我是灵境IDE的用户，正在使用 AI 驱动的开发平台进行 {{projectName}} 项目开发。

通过灵境IDE的智能编程助手，我们的开发效率得到了显著提升。希望能与您分享这一工具的使用体验，并探讨潜在的合作机会。

项目简介：{{projectDescription}}

期待您的回复！

祝好
{{senderName}}`,
    placeholders: ['recipientName', 'projectName', 'projectDescription', 'senderName'],
  },
  {
    key: 'preset_project_invite',
    name: '项目邀请',
    description: '邀请他人加入项目协作',
    subjectTemplate: '邀请您加入 {{projectName}} 项目',
    bodyTemplate: `Hi {{recipientName}}，

诚邀您加入 {{projectName}} 项目的开发协作。

项目地址：{{projectUrl}}
协作方式：{{collaborationMode}}

我们使用灵境IDE作为主要的开发环境，它提供了强大的 AI 辅助编程能力。如果您感兴趣，可以在 https://lingjing.ai 了解更多。

期待与您一起协作！

{{senderName}}`,
    placeholders: ['recipientName', 'projectName', 'projectUrl', 'collaborationMode', 'senderName'],
  },
  {
    key: 'preset_thank_you',
    name: '感谢信',
    description: '感谢合作伙伴或贡献者',
    subjectTemplate: '感谢您对 {{projectName}} 的贡献',
    bodyTemplate: `Dear {{recipientName}}，

衷心感谢您对 {{projectName}} 项目的 {{contributionType}}。

您的贡献极大地推动了项目进展：{{impactDescription}}

我们期待继续与您合作！

{{senderName}}`,
    placeholders: ['recipientName', 'projectName', 'contributionType', 'impactDescription', 'senderName'],
  },
  {
    key: 'preset_feedback_request',
    name: '反馈请求',
    description: '请求用户或测试者提供反馈',
    subjectTemplate: '{{projectName}} - 我们需要您的反馈',
    bodyTemplate: `Hi {{recipientName}}，

{{projectName}} 的 {{version}} 版本已发布，我们非常希望听到您的使用反馈。

主要更新内容：
{{updateSummary}}

请在方便时分享您的想法和建议：{{feedbackLink}}

感谢您的支持！

{{senderName}}`,
    placeholders: ['recipientName', 'projectName', 'version', 'updateSummary', 'feedbackLink', 'senderName'],
  },
  {
    key: 'preset_bug_report',
    name: 'Bug 报告',
    description: '向维护者报告问题',
    subjectTemplate: '[Bug Report] {{projectName}}: {{issueSummary}}',
    bodyTemplate: `Hi {{recipientName}}，

在 {{projectName}} 的 {{version}} 版本中发现了以下问题：

**问题描述**：
{{issueDescription}}

**复现步骤**：
{{reproSteps}}

**环境信息**：
- 操作系统：{{osInfo}}
- 浏览器/运行时：{{runtimeInfo}}

此致
{{senderName}}`,
    placeholders: ['recipientName', 'projectName', 'version', 'issueSummary', 'issueDescription', 'reproSteps', 'osInfo', 'runtimeInfo', 'senderName'],
  },
  {
    key: 'preset_release_announce',
    name: '发布公告',
    description: '宣布新版本发布',
    subjectTemplate: '{{projectName}} {{version}} 发布公告',
    bodyTemplate: `Hi {{recipientName}}，

我们很高兴地宣布 {{projectName}} {{version}} 正式发布！

🎉 新特性：
{{newFeatures}}

🔧 修复：
{{bugFixes}}

📥 下载地址：{{downloadUrl}}

感谢所有贡献者的努力！

{{senderName}}`,
    placeholders: ['recipientName', 'projectName', 'version', 'newFeatures', 'bugFixes', 'downloadUrl', 'senderName'],
  },
];

export class EmailService {
  private config: SmtpConfig | null = null;
  private transporter: any = null;
  private nodemailerLoadError: string | null = null;

  /** 懒加载 nodemailer，避免未安装时启动崩溃 */
  private async ensureNodemailer(): Promise<any> {
    if (this.nodemailerLoadError) {
      throw new Error(this.nodemailerLoadError);
    }
    try {
      // 动态 import nodemailer（esbuild external，运行时 require）
      const nm = await import('nodemailer');
      return nm.default || nm;
    } catch (err: any) {
      this.nodemailerLoadError = `nodemailer 未安装。请在项目目录执行: pnpm add nodemailer (${err.message})`;
      console.error('[EmailService]', this.nodemailerLoadError);
      throw new Error(this.nodemailerLoadError);
    }
  }

  /** 初始化 SMTP 配置 */
  init(config: SmtpConfig): void {
    this.config = { ...config };
    this.transporter = null; // 需要重新创建
  }

  /** 获取或创建 transporter */
  private async getTransporter(): Promise<any> {
    if (!this.config) {
      throw new Error('SMTP 配置未初始化。请先配置 SMTP 服务器。');
    }
    if (!this.transporter) {
      const nm = await this.ensureNodemailer();
      this.transporter = nm.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass,
        },
      });
    }
    return this.transporter;
  }

  /** 验证 SMTP 配置 */
  async validateConfig(config: SmtpConfig): Promise<{ valid: boolean; error?: string }> {
    try {
      this.init(config);
      const transporter = await this.getTransporter();
      const ok = await transporter.verify();
      return { valid: ok === true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  /** 获取预设模板列表 */
  getPresetList(): PresetTemplate[] {
    return PRESET_TEMPLATES;
  }

  /** 获取指定预设模板 */
  getPreset(key: string): PresetTemplate | undefined {
    return PRESET_TEMPLATES.find((p) => p.key === key);
  }

  /** 应用模板占位符 */
  private applyTemplate(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  /** 发送邮件 */
  async sendMail(mailConfig: MailConfig): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const transporter = await this.getTransporter();

      const mailOptions: any = {
        from: this.config!.fromName
          ? `"${this.config!.fromName}" <${this.config!.user}>`
          : this.config!.user,
        to: mailConfig.to,
        subject: mailConfig.subject,
        text: mailConfig.body,
      };

      if (mailConfig.html) mailOptions.html = mailConfig.html;
      if (mailConfig.cc) mailOptions.cc = mailConfig.cc;
      if (mailConfig.bcc) mailOptions.bcc = mailConfig.bcc;

      if (mailConfig.attachments) {
        mailOptions.attachments = mailConfig.attachments;
      }

      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('[EmailService] sendMail error:', err);
      return { success: false, error: err.message };
    }
  }

  /** 使用预设模板发送邮件 */
  async sendWithPreset(
    presetKey: string,
    replacements: Record<string, string>,
    mailConfig: MailConfig,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const preset = this.getPreset(presetKey);
    if (!preset) {
      return { success: false, error: `预设模板 "${presetKey}" 不存在` };
    }

    const subject = this.applyTemplate(preset.subjectTemplate, replacements);
    const body = this.applyTemplate(preset.bodyTemplate, replacements);

    return this.sendMail({
      ...mailConfig,
      subject: mailConfig.subject || subject,
      body: mailConfig.body || body,
    });
  }
}
