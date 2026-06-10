/**
 * Discord Bot Gateway for 灵境 Cloud Server
 *
 * Connects Discord users to the LingJing agent.
 * Uses Discord's Gateway Intents for message events.
 */

import { randomUUID } from 'node:crypto';

class DiscordGateway {
  constructor(token, cloudServerUrl, apiKey) {
    this.token = token;
    this.cloudServerUrl = cloudServerUrl;
    this.apiKey = apiKey;
    this.baseUrl = 'https://discord.com/api/v10';
    this.userSessions = new Map();
    this.heartbeatInterval = null;
    this.ws = null;
  }

  async start() {
    console.log('[DiscordBot] Connecting to Discord Gateway...');

    // Get gateway URL
    const gatewayRes = await fetch(`${this.baseUrl}/gateway`, {
      headers: { Authorization: `Bot ${this.token}` },
    });
    const gatewayData = await gatewayRes.json();
    const wsUrl = gatewayData.url;

    // Connect WebSocket
    this.ws = new WebSocket(`${wsUrl}/?v=10&encoding=json`);

    this.ws.on('open', () => {
      console.log('[DiscordBot] Gateway connected');
    });

    this.ws.on('message', async (raw) => {
      const data = JSON.parse(raw.toString());
      const { op, t, d, s } = data;

      switch (op) {
        case 10: // Hello
          // Start heartbeat
          this.heartbeatInterval = setInterval(() => {
            this.ws.send(JSON.stringify({ op: 1, d: null }));
          }, d.heartbeat_interval);

          // Identify
          this.ws.send(JSON.stringify({
            op: 2,
            d: {
              token: this.token,
              intents: 1 << 9 | 1 << 0, // GUILD_MESSAGES + GUILDS
              properties: { os: 'linux', browser: 'lingjing', device: 'lingjing' },
            },
          }));
          break;

        case 0: // Dispatch
          if (t === 'MESSAGE_CREATE' && !d.author.bot) {
            await this.handleMessage(d);
          }
          break;
      }

      // Update sequence number
      if (s) this.lastSeq = s;
    });

    this.ws.on('close', (code) => {
      console.log(`[DiscordBot] Disconnected (code ${code}), reconnecting in 5s...`);
      clearInterval(this.heartbeatInterval);
      setTimeout(() => this.start(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('[DiscordBot] WS error:', err.message);
    });
  }

  stop() {
    clearInterval(this.heartbeatInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async handleMessage(msg) {
    const userId = `${msg.author.username}#${msg.author.discriminator}`;
    const text = msg.content;
    const channelId = msg.channel_id;

    if (!text || text.startsWith('/')) return;

    console.log(`[DiscordBot] ${userId}: ${text.slice(0, 100)}`);

    try {
      // Forward to agent
      let conversationId = this.userSessions.get(userId);
      if (!conversationId) {
        conversationId = `dc-${userId}-${randomUUID().slice(0, 8)}`;
        this.userSessions.set(userId, conversationId);
      }

      const res = await fetch(`${this.cloudServerUrl}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          message: text,
          userId: `discord:${userId}`,
          userName: msg.author.global_name || msg.author.username,
          conversationId,
          platform: 'discord',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Agent API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const reply = data.reply || '(no response)';

      // Discord max message length is 2000
      const chunks = reply.length > 1900
        ? [reply.slice(0, 1900) + '\n...']
        : [reply];

      for (const chunk of chunks) {
        await fetch(`${this.baseUrl}/channels/${channelId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${this.token}`,
          },
          body: JSON.stringify({ content: chunk }),
        });
      }
    } catch (err) {
      console.error('[DiscordBot] Forward error:', err.message);
    }
  }
}

export function createDiscordBot(token, cloudServerUrl, apiKey) {
  return new DiscordGateway(token, cloudServerUrl, apiKey);
}
