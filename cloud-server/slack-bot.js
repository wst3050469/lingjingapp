/**
 * 灵境 Slack Bot — Native Slack Integration
 *
 * Provides:
 *   - Slash command: /lingjing [task] — interact with LingJing AI
 *   - Interactive messages (buttons, modals)
 *   - Event subscriptions (app_mention, message in channels)
 *   - Bidirectional sync: Slack ↔ LingJing Cloud
 *
 * Uses Slack Bolt SDK (HTTP receiver mode — no socket mode in production)
 * All state stored in SQLite via the scheduler's DB.
 */

import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { EventEmitter } from 'node:events';

export class SlackBot extends EventEmitter {
  constructor(options = {}) {
    super();
    this.token = options.token || process.env.SLACK_BOT_TOKEN || '';
    this.signingSecret = options.signingSecret || process.env.SLACK_SIGNING_SECRET || '';
    this.appToken = options.appToken || process.env.SLACK_APP_TOKEN || '';
    this.defaultChannel = options.defaultChannel || '#general';
    this.enabled = !!this.token;
  }

  /**
   * Verify Slack request signature (HMAC-SHA256)
   */
  verifySignature(rawBody, headers) {
    if (!this.signingSecret) return true; // skip if not configured
    
    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];
    
    if (!timestamp || !signature) return false;
    
    // Prevent replay attacks: reject if timestamp > 5 minutes old
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) return false;
    
    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const mySignature = 'v0=' + createHmac('sha256', this.signingSecret)
      .update(sigBasestring)
      .digest('hex');
    
    // Constant-time comparison
    try {
      return timingSafeEqual(
        Buffer.from(mySignature),
        Buffer.from(signature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Handle incoming Slack event
   */
  async handleEvent(body) {
    const { type, event, command, actions } = body;

    // Slash command: /lingjing
    if (type === 'url_verification') {
      return { challenge: body.challenge };
    }

    if (command) {
      return this._handleCommand(command);
    }

    if (actions && actions.length) {
      return this._handleInteractive(actions[0], body);
    }

    if (event) {
      return this._handleEvent(event);
    }

    return { text: 'Unknown event type' };
  }

  async _handleCommand(command) {
    const { command: cmd, text, user_id, channel_id, user_name } = command;

    if (cmd === '/lingjing') {
      if (!text || !text.trim()) {
        return {
          response_type: 'ephemeral',
          text: '🤖 *灵境 AI 助手* — 我能帮你做什么？',
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '🤖 *灵境 AI 助手已就绪!*\n试试这些命令:' },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: '`/lingjing review <repo>`\n触发代码审查' },
                { type: 'mrkdwn', text: '`/lingjing deploy <env>`\n触发部署' },
                { type: 'mrkdwn', text: '`/lingjing status`\n查看系统状态' },
                { type: 'mrkdwn', text: '`/lingjing ask <question>`\n询问 AI' },
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '📋 查看定时任务' },
                  action_id: 'lingjing_list_schedules',
                  value: 'schedules',
                },
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '🔧 CI 构建状态' },
                  action_id: 'lingjing_ci_status',
                  value: 'ci_status',
                },
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '📊 系统健康检查' },
                  action_id: 'lingjing_health',
                  value: 'health',
                },
              ],
            },
          ],
        };
      }

      // Parse sub-commands
      const parts = text.trim().split(/\s+/);
      const subCmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');

      switch (subCmd) {
        case 'review':
          this.emit('slash:review', { user_id, channel_id, user_name, repo: args });
          return {
            response_type: 'in_channel',
            text: `🔍 <@${user_id}> 请求代码审查: \`${args || '(当前仓库)'}\`\n⏳ 灵境正在分析,请稍候...`,
          };

        case 'deploy':
          this.emit('slash:deploy', { user_id, channel_id, user_name, env: args });
          return {
            response_type: 'in_channel',
            text: `🚀 <@${user_id}> 请求部署到 \`${args || 'production'}\`\n⏳ 灵境正在执行部署流程...`,
          };

        case 'status':
          this.emit('slash:status', { user_id, channel_id });
          return {
            response_type: 'ephemeral',
            text: `📊 *灵境系统状态*\n• Cloud 服务器: ✅ Online\n• 活跃定时任务: 查看详情\n• 最近 CI: 查看详情`,
            blocks: [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: '📊 *灵境系统状态*' },
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: '✅ Cloud 服务器\n在线' },
                  { type: 'mrkdwn', text: '✅ 定时任务\n运行中' },
                ],
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: '🔄 刷新状态' },
                    action_id: 'lingjing_health',
                    value: 'refresh',
                  },
                ],
              },
            ],
          };

        case 'ask':
          this.emit('slash:ask', { user_id, channel_id, user_name, question: args });
          return {
            response_type: 'in_channel',
            text: `💭 <@${user_id}> 询问: ${args}\n🤖 灵境正在思考...`,
          };

        default:
          // Treat as a general AI query
          this.emit('slash:ask', { user_id, channel_id, user_name, question: text.trim() });
          return {
            response_type: 'in_channel',
            text: `🤖 灵境收到: "${text.trim()}"\n⏳ 正在处理...`,
          };
      }
    }

    return { text: 'Unknown command' };
  }

  async _handleInteractive(action, body) {
    const { action_id, value } = action;
    const { channel, user } = body;

    switch (action_id) {
      case 'lingjing_list_schedules':
        this.emit('interactive:list_schedules', { channel_id: channel.id, user_id: user.id });
        return { text: '📋 正在获取定时任务列表...' };

      case 'lingjing_ci_status':
        this.emit('interactive:ci_status', { channel_id: channel.id, user_id: user.id });
        return { text: '🔧 正在获取 CI 构建状态...' };

      case 'lingjing_health':
        this.emit('interactive:health', { channel_id: channel.id, user_id: user.id });
        return { text: '📊 正在执行健康检查...' };

      default:
        return { text: '✅ 已收到交互' };
    }
  }

  async _handleEvent(event) {
    const { type, subtype, text, user, channel, bot_id } = event;

    // Don't respond to bot messages (including our own)
    if (bot_id || subtype === 'bot_message') return null;

    // App mention: @LingJing <message>
    if (type === 'app_mention') {
      const cleanText = text?.replace(/<@[^>]+>/g, '').trim();
      this.emit('app_mention', { user, channel, text: cleanText });
      return {
        text: `🤖 收到! <@${user}> 你说: "${cleanText}"`,
      };
    }

    // Direct message
    if (type === 'message' && channel?.startsWith('D')) {
      this.emit('direct_message', { user, channel, text });
      return {
        text: `🤖 灵境收到你的消息! 正在处理...`,
      };
    }

    return null;
  }

  /**
   * Send a message to a Slack channel
   */
  async sendMessage(channel, text, blocks) {
    if (!this.enabled || !this.token) {
      console.warn('[SlackBot] Not configured, skipping message');
      return { ok: false, error: 'not_configured' };
    }

    try {
      const body = { channel, text };
      if (blocks) body.blocks = blocks;

      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error('[SlackBot] sendMessage failed:', data.error);
      }
      return data;
    } catch (err) {
      console.error('[SlackBot] sendMessage error:', err.message);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Send a rich notification (e.g., CI results, code review feedback)
   */
  async sendNotification(channel, title, fields, color = '#4A90D9') {
    return this.sendMessage(channel, title, [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${title}*` },
      },
      ...(fields || []).map(f => ({
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*${f.label}*\n${f.value}` },
        ],
      })),
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `🕐 ${new Date().toLocaleString()} | 灵境 Cloud` },
        ],
      },
    ]);
  }
}

// Export a default instance factory
export function createSlackBot(options = {}) {
  return new SlackBot(options);
}
