/**
 * Telegram Bot Gateway for 灵境 Cloud Server
 *
 * Connects Telegram users to the LingJing agent via cloud-server WebSocket.
 * Users send messages in Telegram → forwarded to agent → replies back to Telegram.
 *
 * Inspired by Hermes Agent's multi-platform messaging gateway.
 */

import { randomUUID } from 'node:crypto';

// Simple Telegram Bot API wrapper — no external libs needed
class TelegramGateway {
  constructor(token, cloudServerUrl, apiKey) {
    this.token = token;
    this.cloudServerUrl = cloudServerUrl;
    this.apiKey = apiKey;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.offset = 0;
    this.polling = false;
    this.userSessions = new Map(); // userId → conversationId
  }

  /**
   * Start long-polling for Telegram updates.
   */
  async start() {
    console.log('[TelegramBot] Starting long-polling...');
    this.polling = true;

    while (this.polling) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          await this.handleUpdate(update);
        }
      } catch (err) {
        console.error('[TelegramBot] Poll error:', err.message);
        await sleep(5000);
      }
      await sleep(1000);
    }
  }

  stop() {
    this.polling = false;
  }

  async getUpdates() {
    const res = await fetch(
      `${this.baseUrl}/getUpdates?offset=${this.offset}&timeout=30`,
      { signal: AbortSignal.timeout(35_000) }
    );
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }
    return data.result;
  }

  async handleUpdate(update) {
    if (!update.message?.text) return;

    this.offset = update.update_id + 1;
    const msg = update.message;
    const userId = String(msg.from.id);
    const userName = msg.from.first_name || 'User';
    const text = msg.text;

    console.log(`[TelegramBot] ${userName}(${userId}): ${text.slice(0, 100)}`);

    // Route to agent
    try {
      const reply = await this.forwardToAgent(userId, userName, text);
      await this.sendMessage(msg.chat.id, reply);
    } catch (err) {
      console.error('[TelegramBot] Forward error:', err.message);
      await this.sendMessage(msg.chat.id, `⚠️ ${err.message}`);
    }
  }

  /**
   * Forward a user message to the cloud server agent and get a response.
   * Uses the same cloud-session API that the desktop client uses.
   */
  async forwardToAgent(userId, userName, text) {
    // Get or create conversation for this user
    let conversationId = this.userSessions.get(userId);
    if (!conversationId) {
      conversationId = `tg-${userId}-${randomUUID().slice(0, 8)}`;
      this.userSessions.set(userId, conversationId);
    }

    // Call cloud server agent API
    const res = await fetch(`${this.cloudServerUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        message: text,
        userId: `telegram:${userId}`,
        userName,
        conversationId,
        platform: 'telegram',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Agent API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.reply || '(no response)';
  }

  async sendMessage(chatId, text) {
    // Telegram max message length is 4096
    const chunks = splitMessage(text, 4000);
    for (const chunk of chunks) {
      await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'Markdown',
        }),
      });
    }
  }
}

// ── Helpers ──

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = maxLen;
    // Try to cut at a newline
    const lastNewline = remaining.lastIndexOf('\n', maxLen);
    if (lastNewline > maxLen * 0.5) cut = lastNewline;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

// ── Factory ──

export function createTelegramBot(token, cloudServerUrl, apiKey) {
  return new TelegramGateway(token, cloudServerUrl, apiKey);
}
