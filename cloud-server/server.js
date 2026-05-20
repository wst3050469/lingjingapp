/**
 * 灵境(CodePilot) Cloud Server v2
 * REST API + WebSocket + Real Webhook Forwarding
 * Supports: Slack, Discord, GitHub CI, and custom channels
 */

import http from 'node:http';
import { randomUUID, createHmac, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { initDB, closeDB } from './db.js';
import { CloudScheduler } from './scheduler.js';
import { SlackBot, createSlackBot } from './slack-bot.js';
import { CiIntegration, createCiIntegration } from './ci-integration.js';
import { TenantManager } from './tenant.js';
import { createTelegramBot } from './bots/telegram-bot.js';

import { createPayment, queryPayment, handlePaymentNotify, confirmPayment } from './payment-gateway.js';
import { createDiscordBot } from './bots/discord-bot.js';
import { registerAdminAPI } from './admin-api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Version cache - 30s TTL
let _verCache = null;
let _verCacheTime = 0;
const _verTTL = 30000;
const PORT = process.env.PORT || 8000;

// Security: Require environment variables in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.API_KEY || process.env.API_KEY.length < 32) {
    console.error('[FATAL] API_KEY must be set and at least 32 characters in production');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[FATAL] JWT_SECRET must be set and at least 32 characters in production');
    process.exit(1);
  }
}

const API_KEY = process.env.API_KEY || 'lingjing-cloud-key-dev-only';
const JWT_SECRET = process.env.JWT_SECRET || 'lingjing-jwt-secret-dev-only-' + API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const JWT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const app = express();
app.use(express.json({ limit: '50mb' }));

// Global error handler — prevents JSON parse crashes from leaking HTML to clients
app.use((err, req, res, _next) => {
  console.error('[Server] Error', req.method, req.path, '->', err.message);
  res.status(500).json({ error: 'internal_error', detail: err.message });
});

// ====== Webhook Forwarding Config ======
const CONFIG_PATH = resolve(__dirname, 'webhooks.json');
let webhookConfig = {};

function loadWebhookConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      webhookConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      console.log('[Webhooks] Loaded config:', Object.keys(webhookConfig).join(', ') || '(none)');
    }
  } catch (e) {
    console.warn('[Webhooks] Failed to load config:', e.message);
  }
}
loadWebhookConfig();

/**
 * Forward webhook payload to real services.
 * Returns array of { service, status, detail } for logging.
 */
async function forwardWebhook(channel, payload) {
  const results = [];
  const cfg = webhookConfig[channel];
  if (!cfg) return results; // No forwarding configured for this channel

  // ── Slack ──
  if (cfg.slack) {
    try {
      const slackBody = {
        text: cfg.slackText || `*灵境 Webhook* — Channel: \`${channel}\``,
        attachments: [{
          color: '#4A90D9',
          title: 'Payload',
          text: '```' + JSON.stringify(payload, null, 2).slice(0, 3000) + '```',
          footer: '灵境 Cloud',
          ts: Math.floor(Date.now() / 1000),
        }],
      };
      const slackRes = await fetch(cfg.slack, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackBody),
      });
      results.push({ service: 'slack', status: slackRes.ok ? 'ok' : 'fail', detail: slackRes.status });
    } catch (e) {
      results.push({ service: 'slack', status: 'error', detail: e.message });
    }
  }

  // ── Discord ──
  if (cfg.discord) {
    try {
      const discordBody = {
        username: '灵境 Cloud',
        avatar_url: 'https://img.icons8.com/fluency/48/code.png',
        embeds: [{
          title: `Webhook: ${channel}`,
          description: '```json\n' + JSON.stringify(payload, null, 2).slice(0, 4000) + '\n```',
          color: 0x4A90D9,
          timestamp: new Date().toISOString(),
          footer: { text: '灵境 Cloud Sync' },
        }],
      };
      const discordRes = await fetch(cfg.discord, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordBody),
      });
      results.push({ service: 'discord', status: discordRes.ok ? 'ok' : 'fail', detail: discordRes.status });
    } catch (e) {
      results.push({ service: 'discord', status: 'error', detail: e.message });
    }
  }

  // ── GitHub Repository Dispatch ──
  if (cfg.github) {
    try {
      const { owner, repo, token, event_type } = cfg.github;
      if (owner && repo && token) {
        const ghRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/dispatches`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              event_type: event_type || 'lingjing-webhook',
              client_payload: { channel, ...payload },
            }),
          }
        );
        results.push({ service: 'github', status: ghRes.ok ? 'ok' : 'fail', detail: ghRes.status });
      }
    } catch (e) {
      results.push({ service: 'github', status: 'error', detail: e.message });
    }
  }

  // ── Generic / Custom URL ──
  if (cfg.url) {
    try {
      const customRes = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cfg.headers || {}) },
        body: JSON.stringify({ channel, payload }),
      });
      results.push({ service: 'custom', status: customRes.ok ? 'ok' : 'fail', detail: customRes.status });
    } catch (e) {
      results.push({ service: 'custom', status: 'error', detail: e.message });
    }
  }

  return results;
}

// ====== JWT Helpers (native crypto, zero deps) ======
function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function signJWT(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

// ====== Password Helpers (zero deps, using built-in crypto) ======
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored, storedSalt) {
  // Support two storage formats:
  // NEW: stored = "salt:hash" combined string
  // OLD: stored = hash-only, storedSalt = salt (separate column)
  let salt, hash;
  const parts = stored.split(':');
  if (parts.length === 2) {
    // NEW format: "salt:hash"
    salt = parts[0];
    hash = parts[1];
  } else if (storedSalt) {
    // OLD format: hash-only in stored, salt in storedSalt
    salt = storedSalt;
    hash = stored;
  } else {
    return false;
  }
  if (!salt || !hash) return false;
  const verify = scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(verify), Buffer.from(hash));
}

// ====== Auth middleware ======
function auth(req, res, next) {
  // Support x-api-key header
  const apiKey = req.headers['x-api-key'];
  if (apiKey === API_KEY) {
    req.userId = 'api-key-user';
    req.username = 'API Key';
    req.isApiKeyUser = true;
    return next();
  }

  // Support Bearer token
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Try user JWT first (HMAC)
    let payload = verifyJWT(token);
    // Fallback to admin JWT (SHA256 hash)
    if (!payload) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (body.role === 'admin') {
            payload = body;
          }
        }
      } catch (e) { /* not admin JWT */ }
    }
    if (payload) {
      req.deviceId = payload.sub;
      req.deviceName = payload.name;
      if (payload.role === 'user') {
        req.userId = payload.sub;
        req.username = payload.name;
      }
      if (payload.role === 'admin') {
        req.userId = 'admin';
        req.username = payload.sub || 'admin';
      }
      return next();
    }
  }

  // Support api_key query param
  if (req.query.api_key === API_KEY) return next();

  return res.status(401).json({ error: 'unauthorized' });
}

// ── API Usage Rate Limiter (in-memory, per user per day) ──
const apiUsageCounts = new Map();

function resetUsageCounts() {
  apiUsageCounts.clear();
}
// Reset every 24 hours
setInterval(resetUsageCounts, 24 * 60 * 60 * 1000).unref();

function getDailyApiCalls(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const key = userId + ':' + today;
  return apiUsageCounts.get(key) || 0;
}

function incrementDailyApiCalls(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const key = userId + ':' + today;
  apiUsageCounts.set(key, (apiUsageCounts.get(key) || 0) + 1);
}

const PLAN_HIERARCHY = { free: 0, personal: 1, pro: 2, enterprise: 3 };

function getUserSubscription(userId) {
  try {
    const sub = db.prepare(
      'SELECT s.*, p.name as plan_name, p.features, p.limits FROM subscriptions s LEFT JOIN plans p ON s.plan_id = p.id WHERE s.user_id = ? AND s.status = ? ORDER BY s.started_at DESC LIMIT 1'
    ).get(userId, 'active');

    const freePlan = db.prepare("SELECT * FROM plans WHERE id = 'free'").get();
    const defLimits = freePlan ? JSON.parse(freePlan.limits || '{}') : { apiCalls: 100, storage: 100, workflows: 5, devices: 2 };
    const defFeatures = freePlan ? JSON.parse(freePlan.features || '[]') : [];

    // Real usage tracking
    const apiCallsToday = getDailyApiCalls(userId);
    const storageFileCount = db.prepare('SELECT COUNT(*) as count FROM storage_files WHERE user_id = ?').get(userId)?.count || 0;
    const apiKeyCount = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?').get(userId)?.count || 0;

    const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get(userId)?.count || 0;
    const memoryCount = db.prepare('SELECT COUNT(*) as count FROM memories WHERE user_id = ?').get(userId)?.count || 0;
    const usage = {
      apiCalls: apiCallsToday,
      storageFiles: storageFileCount,
      apiKeys: apiKeyCount,
      sessions: sessionCount,
      memories: memoryCount,
    };

    if (!sub) {
      return { planId: 'free', planName: '免费版', status: 'active', limits: defLimits, features: defFeatures, tier: 0, usage };
    }

    const limits = JSON.parse(sub.limits || '{}');
    const features = JSON.parse(sub.features || '[]');
    const tier = PLAN_HIERARCHY[sub.plan_id] !== undefined ? PLAN_HIERARCHY[sub.plan_id] : 0;

    return {
      planId: sub.plan_id, planName: sub.plan_name || sub.plan_id,
      status: sub.status, limits, features, tier,
      subscriptionId: sub.id, expiresAt: sub.expires_at,
      usage,
    };
  } catch (err) {
    console.error('[Subscription] getUserSubscription error:', err.message);
    return { planId: 'free', planName: '免费版', status: 'active', limits: { apiCalls: 100, storage: 100, workflows: 5, devices: 2 }, features: [], tier: 0, usage: { apiCalls: 0, storageFiles: 0, apiKeys: 0, sessions: 0, memories: 0 } };
  }
}

function requireSubscription(minPlanId, checkQuota) {
  if (minPlanId === undefined) minPlanId = null;
  if (checkQuota === undefined) checkQuota = false;
  return (req, res, next) => {
    if (!req.userId) return next();
    try {
      const sub = getUserSubscription(req.userId);
      req.subscription = sub;
      if (minPlanId) {
        const minTier = PLAN_HIERARCHY[minPlanId] !== undefined ? PLAN_HIERARCHY[minPlanId] : 0;
        if (sub.tier < minTier) {
          return res.status(403).json({ error: 'subscription_required', requiredPlan: minPlanId, currentPlan: sub.planId, message: '当前套餐「' + sub.planName + '」不支持此功能，请升级套餐' });
        }
      }
      if (checkQuota) {
        const apiLimit = sub.limits.apiCalls || 100;
        const todayCount = getDailyApiCalls(req.userId);
        if (todayCount >= apiLimit) {
          return res.status(429).json({ error: 'api_quota_exceeded', limit: apiLimit, current: todayCount, plan: sub.planId, message: '每日API调用限制(' + apiLimit + '次)已用尽，请升级套餐或等待次日重置' });
        }
      }
      next();
    } catch (err) {
      console.error('[Subscription] requireSubscription error:', err.message);
      next();
    }
  };
}


/**
 * Activate subscription after successful payment.
 * Finds the subscription linked to a payment and marks it active.
 */
function activateSubscriptionAfterPayment(paymentId, transactionId) {
  try {
    // Find the payment record
    const payment = db.prepare('SELECT * FROM payments WHERE id = ? OR transaction_id = ?').get(paymentId, transactionId);
    if (!payment) {
      console.log('[Payment] No payment record found for activation:', paymentId);
      return;
    }
    // Update payment status
    db.prepare('UPDATE payments SET payment_status = ?, paid_at = ? WHERE id = ?')
      .run('success', new Date().toISOString(), payment.id);
    
    // If payment is linked to a subscription, activate it
    if (payment.subscription_id) {
      const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(payment.subscription_id);
      if (sub && sub.status !== 'active') {
        const now = new Date().toISOString();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // 1 month from activation
        db.prepare('UPDATE subscriptions SET status = ?, started_at = ?, expires_at = ? WHERE id = ?')
          .run('active', now, endDate.toISOString(), payment.subscription_id);
        console.log('[Payment] Subscription activated:', payment.subscription_id);
      }
    }
  } catch (err) {
    console.error('[Payment] activation error:', err.message);
  }
}

// ====== Database ======
const db = initDB();

// Register Admin Management API
registerAdminAPI(app, db);

// ====== REST API ======

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0', uptime: process.uptime(), node: process.version });
});

// ── Version Info (for electron-updater) ──
// Reads from versions.json (supports both download-list and update-server formats)
function readVersionInfo() {
  const _now = Date.now();
  if (_verCache && _now - _verCacheTime < _verTTL) { console.log('[Version] CACHE HIT'); return _verCache; }
  try {
    // Try multiple paths to find versions.json
    const searchPaths = [
      '/var/www/html/downloads/versions.json',
      '/root/lingjing-update/data/versions.json',
      '/var/www/update-server/data/versions.json',
      '/opt/lingjing-update/data/versions.json',
      resolve(__dirname, '..', 'update-server', 'data', 'versions.json'),
      resolve(__dirname, '..', '..', 'var', 'www', 'update-server', 'data', 'versions.json'),
    ];
    let data = null;
    let sourcePath = null;
    for (const p of searchPaths) {
      if (existsSync(p)) {
        data = JSON.parse(readFileSync(p, 'utf8'));
        sourcePath = p;
        console.log('[Version] Loaded from:', p);
        break;
      }
    }
    if (!data) {
      console.warn('[Version] versions.json not found in any path, using default');
      _verCache = { hasUpdate: false, version: '0.0.0' };
        _verCacheTime = _now;
        return _verCache;
    }

    // ── Format detection ──
    // Format A (download-list): { version, platforms, notes }
    // Format B (update-server): { latest, versions: [{ version, ... }] }
    if (data.platforms && data.version) {
      // Convert download-list format on the fly
      const versionStr = data.version;
      const files = {};
      for (const [platform, info] of Object.entries(data.platforms)) {
        if (info.url) {
          files[platform] = 'https://ide.zhejiangjinmo.com/downloads/' + info.url;
        }
      }
      return {
        hasUpdate: true,
        version: versionStr,
        status: 'published',
        releaseDate: new Date().toISOString(),
        releaseNotes: data.notes || ('灵境IDE v' + versionStr),
        files,
      };
    }

    // Format B: update-server format with versions array
    if (data.versions) {
      const nonDraftVersions = data.versions.filter(v => v.status !== 'draft');
      const latestEntry = data.versions.find(v => v.version === data.latest && v.status !== 'draft');
      const latest = latestEntry || nonDraftVersions[0];
      if (latest) {
        _verCache = {
          hasUpdate: true,
          version: latest.version || '1.4.0',
          status: latest.status || 'published',
          releaseDate: latest.releaseDate || new Date().toISOString(),
          releaseNotes: latest.releaseNotes || ('灵境IDE v' + (latest.version || '1.4.0')),
          files: latest.files || {},
        };
        _verCacheTime = _now;
        return _verCache;
      }
      // All versions are drafts — no public update available
      _verCache = { hasUpdate: false, version: '0.0.0', releaseNotes: '暂无已发布的更新' };
        _verCacheTime = _now;
        return _verCache;
    }

    console.warn('[Version] Unrecognized versions.json format in:', sourcePath);
  } catch (e) {
    console.error('[Version] Error:', e.message);
  }
  return { hasUpdate: false, version: '0.0.0' };
}
app.get('/api/latest', (req, res) => {
  res.json(readVersionInfo());
});

// ── Auth: Device Registration ──
app.post('/api/auth/register', (req, res) => {
  const { deviceId, deviceName, deviceInfo, apiKey } = req.body;

  // Require API key for registration
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'invalid_api_key' });
  }

  const id = deviceId || randomUUID();
  const name = deviceName || 'Unknown Device';
  const now = new Date().toISOString();

  // Generate JWT
  const token = signJWT({
    sub: id,
    name,
    iat: Date.now(),
    exp: Date.now() + JWT_EXPIRY_MS,
  });

  // Upsert device
  const existing = db.prepare('SELECT id FROM devices WHERE id = ?').get(id);
  if (existing) {
    db.prepare('UPDATE devices SET name = ?, device_info = ?, token = ?, last_seen = ? WHERE id = ?')
      .run(name, JSON.stringify(deviceInfo || {}), token, now, id);
  } else {
    db.prepare('INSERT INTO devices (id, name, device_info, token, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, JSON.stringify(deviceInfo || {}), token, now, now);
  }

  console.log(`[Auth] Device registered: ${name} (${id})`);
  res.json({
    ok: true,
    deviceId: id,
    token,
    expiresIn: JWT_EXPIRY_MS,
    serverVersion: '3.0.0',
  });
});

// Verify JWT token
app.post('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'no_token' });
  }

  const payload = verifyJWT(authHeader.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  // Update last_seen
  db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?')
    .run(new Date().toISOString(), payload.sub);

  res.json({
    ok: true,
    deviceId: payload.sub,
    deviceName: payload.name,
    expiresAt: payload.exp ? new Date(payload.exp).toISOString() : null,
  });
});

// List registered devices (requires API key)
app.get('/api/auth/devices', auth, (req, res) => {
  const devices = db.prepare('SELECT id, name, last_seen, created_at FROM devices ORDER BY last_seen DESC').all();
  res.json(devices);
});

// Device heartbeat - keeps device online status
app.put('/api/devices/heartbeat', auth, (req, res) => {
  try {
    const now = new Date().toISOString();
    const deviceId = req.deviceId || req.body?.deviceId;
    if (deviceId) {
      db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(now, deviceId);
    }
    res.json({ ok: true, timestamp: now });
  } catch (err) {
    res.json({ ok: true }); // Silently succeed - heartbeat is best-effort
  }
});

// ── Helpers ──
function safeJsonParse(val, fallback) {
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}


// ── User Auth ──
// User login - returns JWT token for cloud API access
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username_and_password_required' });
  }

  try {
    const user = db.prepare('SELECT id, username, email, password_hash, password_salt, avatar, registered_at FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const valid = verifyPassword(password, user.password_hash, user.password_salt);
    if (!valid) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .run(new Date().toISOString(), user.id);

    const token = signJWT({
      sub: user.id,
      name: user.username,
      role: 'user',
      iat: Date.now(),
      exp: Date.now() + JWT_EXPIRY_MS,
    });

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        registeredAt: user.registered_at,
      },
      expiresIn: JWT_EXPIRY_MS,
    });
  } catch (err) {
    console.error('[Auth] login error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// User signup - register new user account
app.post('/api/auth/signup', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username_and_password_required' });
  }
  if (username.length < 2 || password.length < 6) {
    return res.status(400).json({ error: 'username_min_2_and_password_min_6' });
  }

  try {
    // Check if username or email already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR (email = ? AND email != \'\')').get(username, email || '');
    if (existing) {
      return res.status(409).json({ error: 'user_already_exists' });
    }

    const id = randomUUID();
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    db.prepare('INSERT INTO users (id, username, email, password_hash, password_salt, registered_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, username, email || (username + '@lingjing.local'), passwordHash, passwordHash.split(':')[0] || '', now, now);

    const token = signJWT({
      sub: id,
      name: username,
      role: 'user',
      iat: Date.now(),
      exp: Date.now() + JWT_EXPIRY_MS,
    });

    console.log('[Auth] User registered:', username, '(' + id + ')');
    res.status(201).json({
      ok: true,
      token,
      user: {
        id,
        username,
        email: email || '',
        registeredAt: now,
      },
      expiresIn: JWT_EXPIRY_MS,
    });
  } catch (err) {
    console.error('[Auth] signup error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Get current user profile
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'no_token' });
  }

  const payload = verifyJWT(authHeader.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  try {
    const user = db.prepare('SELECT id, username, email, avatar, registered_at, last_login_at FROM users WHERE id = ?').get(payload.sub);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        registeredAt: user.registered_at,
        lastLoginAt: user.last_login_at,
      },
    });
  } catch (err) {
    console.error('[Auth] me error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── Subscription Plans (public) ──
app.get('/api/plans', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM plans ORDER BY price ASC').all();
    const plans = rows.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      billingCycle: p.billing_cycle,
      features: JSON.parse(p.features || '[]'),
      limits: JSON.parse(p.limits || '{}'),
      recommended: !!p.recommended,
    }));
    res.json(plans);
  } catch (err) {
    console.error('[Plans] error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── User Subscription ──
// Get current user's subscription
app.get('/api/subscriptions/mine', auth, (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: '需要用户认证' });
    }
    const sub = db.prepare('SELECT s.*, p.name as plan_name, p.price, p.features, p.limits FROM subscriptions s LEFT JOIN plans p ON s.plan_id = p.id WHERE s.user_id = ? ORDER BY s.started_at DESC LIMIT 1').get(req.userId);
    if (!sub) {
      // Return default free subscription
      const freePlan = db.prepare("SELECT * FROM plans WHERE id = 'free'").get();
      return res.json({
        id: null,
        planId: 'free',
        planName: '免费版',
        status: 'active',
        startDate: null,
        endDate: null,
        autoRenew: false,
        price: 0,
        features: freePlan ? JSON.parse(freePlan.features || '[]') : [],
        limits: freePlan ? JSON.parse(freePlan.limits || '{}') : {},
      });
    }
    res.json({
      id: sub.id,
      userId: sub.user_id,
      planId: sub.plan_id,
      planName: sub.plan_name || sub.plan_id,
      status: sub.status,
      startDate: sub.started_at,
      endDate: sub.expires_at,
      autoRenew: !!sub.auto_renew,
      price: sub.price || 0,
      features: JSON.parse(sub.features || '[]'),
      limits: JSON.parse(sub.limits || '{}'),
    });
  } catch (err) {
    console.error('[Subscription] error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Create/purchase subscription
app.post('/api/subscriptions', auth, (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'user_auth_required' });
    }
    console.log('[Subscription] POST /api/subscriptions body:', JSON.stringify(req.body), 'userId:', req.userId, 'username:', req.username, 'isApiKeyUser:', req.isApiKeyUser);
    const { planId, billingCycle } = req.body;
    if (!planId) {
      console.log('[Subscription] Missing planId in body:', JSON.stringify(req.body));
      return res.status(400).json({ code: 'plan_id_required', message: '缺少套餐ID(planId)', body: req.body });
    }

    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) {
      return res.status(404).json({ message: '套餐不存在' });
    }

    // Check current subscription for upgrade/downgrade logic
    const currentSub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1').get(req.userId, 'active');
    
    // Calculate price based on billing cycle
    const cycle = billingCycle || 'monthly';
    let price = plan.price;
    if (cycle === 'yearly') price = plan.price * 10; // 2 months free
    else if (cycle === 'quarterly') price = plan.price * 3;

    const id = randomUUID();
    const now = new Date().toISOString();
    const endDate = new Date();
    let status = 'active';
    const currentPlanPrice = currentSub ? (currentSub.price || 0) : 0;
    
    if (cycle === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
    else if (cycle === 'quarterly') endDate.setMonth(endDate.getMonth() + 3);
    else if (cycle === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);

    // Upgrade: immediately apply, cancel old
    // Downgrade: immediately apply (pro-rated or effective immediately)
    console.log('[Subscription] Plan change detected: userId=' + req.userId + ' planId=' + planId + ' currentPrice=' + currentPlanPrice + ' newPrice=' + price);
    
    // Deactivate existing active subscriptions
    db.prepare('UPDATE subscriptions SET status = ? WHERE user_id = ? AND status = ?')
      .run('cancelled', req.userId, 'active');

    // Insert new subscription
    db.prepare('INSERT INTO subscriptions (id, user_id, plan_id, plan_name, status, started_at, expires_at, auto_renew) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.userId, planId, plan.name, status, now, endDate.toISOString(), 1);

    // Create payment record
    const paymentId = randomUUID();
    const deviceId = req.body.deviceId || req.headers['x-device-id'] || '';
    db.prepare('INSERT INTO payments (id, user_id, subscription_id, device_id, amount, currency, payment_method, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(paymentId, req.userId, id, deviceId, price, 'CNY', 'invoice', 'pending', now);

    const isDowngrade = currentPlanPrice > price;
    console.log('[Subscription] ' + (isDowngrade ? 'Downgrade' : 'Upgrade') + ' completed:', req.username, plan.name, '(' + id + ')');
    res.status(201).json({
      ok: true,
      id,
      planId,
      planName: plan.name,
      status: status,
      startDate: now,
      endDate: endDate.toISOString(),
      price,
      paymentId,
      isDowngrade: isDowngrade,
      message: isDowngrade ? '已降级至' + plan.name + '，将在当前周期结束后生效' : '已升级至' + plan.name + '，立即生效'
    });
  } catch (err) {
    console.error('[Subscription] create error:', err.message || err);
    res.status(500).json({ message: '服务器内部错误', detail: err.message || 'unknown' });
  }
});

// ====== Subscription Upgrade/Downgrade Endpoints ======

// Upgrade to a higher-tier plan
app.post('/api/subscriptions/upgrade', auth, (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'user_auth_required' });
    console.log('[Subscription] POST /api/subscriptions/upgrade body:', JSON.stringify(req.body), 'userId:', req.userId);
    const { planId, billingCycle } = req.body;
    if (!planId) return res.status(400).json({ code: 'plan_id_required', message: '缺少套餐ID(planId)', body: req.body });
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ message: '套餐不存在' });
    const currentSub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1').get(req.userId, 'active');
    const currentPrice = currentSub ? (currentSub.price || 0) : 0;
    const cycle = billingCycle || 'monthly';
    let newPrice = plan.price;
    if (cycle === 'yearly') newPrice = plan.price * 10;
    else if (cycle === 'quarterly') newPrice = plan.price * 3;
    if (newPrice < currentPrice) {
      return res.status(400).json({ code: 'cannot_downgrade_via_upgrade', message: '不能通过升级接口降级', currentPrice, newPrice });
    }
    return handleSubscribe(req, res, db);
  } catch (err) {
    console.error('[Subscription] upgrade error:', err.message || err);
    res.status(500).json({ message: '服务器内部错误', detail: err.message || 'unknown' });
  }
});

// Downgrade to a lower-tier plan
app.post('/api/subscriptions/downgrade', auth, (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'user_auth_required' });
    console.log('[Subscription] POST /api/subscriptions/downgrade body:', JSON.stringify(req.body), 'userId:', req.userId);
    const { planId, billingCycle } = req.body;
    if (!planId) return res.status(400).json({ code: 'plan_id_required', message: '缺少套餐ID(planId)', body: req.body });
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ message: '套餐不存在' });
    const currentSub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1').get(req.userId, 'active');
    const currentPrice = currentSub ? (currentSub.price || 0) : 0;
    const cycle = billingCycle || 'monthly';
    let newPrice = plan.price;
    if (cycle === 'yearly') newPrice = plan.price * 10;
    else if (cycle === 'quarterly') newPrice = plan.price * 3;
    if (newPrice > currentPrice && currentPrice > 0) {
      return res.status(400).json({ code: 'cannot_upgrade_via_downgrade', message: '不能通过降级接口升级', currentPrice, newPrice });
    }
    return handleSubscribe(req, res, db);
  } catch (err) {
    console.error('[Subscription] downgrade error:', err.message || err);
    res.status(500).json({ message: '服务器内部错误', detail: err.message || 'unknown' });
  }
});

/**
 * Shared subscription handler - used by POST /api/subscriptions and /upgrade, /downgrade
 */
function handleSubscribe(req, res, db) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'user_auth_required' });
    const { planId, billingCycle } = req.body;
    if (!planId) return res.status(400).json({ code: 'plan_id_required', message: '缺少套餐ID(planId)', body: req.body });
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ message: '套餐不存在' });
    const cycle = billingCycle || 'monthly';
    let price = plan.price;
    if (cycle === 'yearly') price = plan.price * 10;
    else if (cycle === 'quarterly') price = plan.price * 3;
    const id = randomUUID();
    const now = new Date().toISOString();
    const endDate = new Date();
    if (cycle === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
    else if (cycle === 'quarterly') endDate.setMonth(endDate.getMonth() + 3);
    else if (cycle === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
    console.log('[Subscription] execute: userId=' + req.userId + ' planId=' + planId + ' price=' + price);
    db.prepare('UPDATE subscriptions SET status = ? WHERE user_id = ? AND status = ?').run('cancelled', req.userId, 'active');
    db.prepare('INSERT INTO subscriptions (id, user_id, plan_id, plan_name, status, started_at, expires_at, auto_renew) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.userId, planId, plan.name, 'active', now, endDate.toISOString(), 1);
    const paymentId = randomUUID();
    const deviceId = req.body.deviceId || req.headers['x-device-id'] || '';
    db.prepare('INSERT INTO payments (id, user_id, subscription_id, device_id, amount, currency, payment_method, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(paymentId, req.userId, id, deviceId, price, 'CNY', 'invoice', 'pending', now);
    const isDowngrade = price < 0;
    console.log('[Subscription] completed:', req.username, plan.name, '(' + id + ')');
    res.status(201).json({
      ok: true, id, planId, planName: plan.name, status: 'active',
      startDate: now, endDate: endDate.toISOString(), price, paymentId,
      isDowngrade,
      message: '已' + (isDowngrade ? '降级' : '升级') + '至' + plan.name
    });
  } catch (err) {
    console.error('[Subscription] handler error:', err.message || err);
    res.status(500).json({ message: '服务器内部错误', detail: err.message || 'unknown' });
  }
}



// Cancel subscription
app.put('/api/subscriptions/mine/cancel', auth, (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'user_auth_required' });
    }
    const result = db.prepare('UPDATE subscriptions SET status = ?, auto_renew = 0 WHERE user_id = ? AND status = ?').run('cancelled', req.userId, 'active');
    if (result.changes === 0) {
      return res.status(404).json({ error: 'no_active_subscription' });
    }
    console.log('[Subscription] Cancelled for user:', req.username);
    res.json({ ok: true, message: '订阅已取消' });
  } catch (err) {
    console.error('[Subscription] cancel error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── Payments ──
// Get payment records for current user
app.get('/api/payments', auth, (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'user_auth_required' });
    }
    const deviceId = req.query.deviceId || '';
    let payments;
    if (deviceId) {
      payments = db.prepare('SELECT * FROM payments WHERE user_id = ? AND device_id = ? ORDER BY created_at DESC').all(req.userId, deviceId);
    } else {
      payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
    }
    res.json(payments.map(p => ({
      id: p.id,
      subscriptionId: p.subscription_id,
      amount: p.amount,
      currency: p.currency,
      paymentMethod: p.payment_method,
      deviceId: p.device_id,
      status: p.payment_status,
      transactionId: p.transaction_id,
      invoiceNumber: p.invoice_number,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    })));
  } catch (err) {
    console.error('[Payments] error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Submit offline payment (对公打款)
app.post('/api/payments/offline', auth, (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'user_auth_required' });
    }
    const { amount, companyName, bankName, bankAccount, remark, receiptUrl } = req.body;
    if (!amount || !companyName) {
      return res.status(400).json({ error: 'amount_and_company_name_required' });
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO offline_payments (id, user_id, amount, company_name, bank_name, bank_account, remark, receipt_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.userId, amount, companyName, bankName || '', bankAccount || '', remark || '', receiptUrl || '', 'pending', now);
    console.log('[Payment] Offline payment submitted:', req.username, amount);
    res.status(201).json({ ok: true, id, status: 'pending', message: '对公打款已提交，等待审核' });
  } catch (err) {
    console.error('[Payment] offline error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── Online Payment Gateway ──
// Create a payment order (supports test/alipay/wechat channels)
app.post('/api/payments/create', auth, async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'user_auth_required' });
    const { channel, amount, subject, planId, billingCycle } = req.body;
    if (!channel || !amount) return res.status(400).json({ error: 'channel_and_amount_required' });
    if (['test', 'alipay', 'wechat'].indexOf(channel) === -1) {
      return res.status(400).json({ error: 'unsupported_channel', supported: ['test', 'alipay', 'wechat'] });
    }
    const result = await createPayment(channel, {
      amount,
      subject: subject || '灵境订阅支付',
      notifyUrl: 'https://ide.zhejiangjinmo.com/api/payments/notify/' + channel,
    });
    // Store payment record in DB
    const paymentId = randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO payments (id, user_id, amount, currency, payment_method, payment_status, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(paymentId, req.userId, amount, 'CNY', channel, 'pending', result.orderId, now);
    console.log('[Payment] Created:', req.username, channel, amount, result.orderId);
    res.status(201).json({ ok: true, paymentId, ...result });
  } catch (err) {
    console.error('[Payment] create error:', err.message);
    res.status(500).json({ error: 'payment_create_failed', detail: err.message });
  }
});

// Payment notification callback (called by Alipay/WeChat or test mode)
app.post('/api/payments/notify/:channel', async (req, res) => {
  try {
    const { channel } = req.params;
    const result = await handlePaymentNotify(channel, req.body);
    if (result.ok && result.status === 'success') {
      activateSubscriptionAfterPayment('', result.orderId);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[Payment] notify error:', err.message);
    res.status(500).json({ error: 'notify_error' });
  }
});

// Query payment status
app.get('/api/payments/query/:orderId', auth, async (req, res) => {
  try {
    const result = await queryPayment(req.params.orderId);
    res.json(result);
  } catch (err) {
    console.error('[Payment] query error:', err.message);
    res.json({ ok: true, status: 'unknown' });
  }
});

// Confirm payment (test mode - simulates user scanning QR code and paying)
app.post('/api/payments/confirm/:orderId', auth, async (req, res) => {
  try {
    const result = await confirmPayment(req.params.orderId);
    if (result.ok && result.status === 'success') {
      activateSubscriptionAfterPayment('', req.params.orderId);
    }
    res.json(result);
  } catch (err) {
    console.error('[Payment] confirm error:', err.message);
    res.json({ ok: false, status: 'error', detail: err.message });
  }
});

// Get invoices for current user
app.get('/api/invoices', auth, (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'user_auth_required' });
    }
    const invoices = db.prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
    res.json(invoices.map(inv => ({
      id: inv.id,
      paymentId: inv.payment_id,
      amount: inv.amount,
      companyName: inv.company_name,
      taxId: inv.tax_id,
      status: inv.status,
      invoiceNumber: inv.invoice_number,
      issuedAt: inv.issued_at,
      createdAt: inv.created_at,
    })));
  } catch (err) {
    console.error('[Invoices] error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Apply for invoice
app.post('/api/invoices', auth, (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'user_auth_required' });
    }
    const { paymentId, amount, companyName, taxId, companyAddress, companyPhone, bankName, bankAccount, email } = req.body;
    if (!amount || !companyName) {
      return res.status(400).json({ error: 'amount_and_company_name_required' });
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO invoices (id, user_id, payment_id, amount, company_name, tax_id, company_address, company_phone, bank_name, bank_account, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.userId, paymentId || '', amount, companyName, taxId || '', companyAddress || '', companyPhone || '', bankName || '', bankAccount || '', email || '', 'pending', now);
    console.log('[Invoice] Created for user:', req.username, amount);
    res.status(201).json({ ok: true, id, status: 'pending', message: '发票申请已提交' });
  } catch (err) {
    console.error('[Invoice] error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── Sessions ──
app.get('/api/sessions', auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  let sessions;
  if (req.userId) {
    sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(req.userId, limit, offset);
  } else {
    sessions = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  }
  res.json(sessions.map(s => ({
    ...s,
    messages: safeJsonParse(s.messages, []),
    metadata: safeJsonParse(s.metadata, {}),
  })));
});

app.post('/api/sessions', auth, requireSubscription(), (req, res) => {
  const { id, title, messages, metadata } = req.body;
  const sid = id || randomUUID();
  const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sid);
  const now = new Date().toISOString();

  // Check session count quota for new sessions (not updates)
  if (!existing && req.userId) {
    const sub = req.subscription || {};
    const sessionLimit = (sub.limits && sub.limits.sessions) || 50;
    const sessionCount = (db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get(req.userId) || {}).count || 0;
    if (sessionCount >= sessionLimit) {
      return res.status(429).json({ error: 'session_limit_exceeded', limit: sessionLimit, current: sessionCount, message: '会话数量已达上限(' + sessionLimit + '个)，请删除旧会话或升级套餐' });
    }
  }

  if (existing) {
    db.prepare('UPDATE sessions SET title = ?, messages = ?, metadata = ?, updated_at = ? WHERE id = ?')
      .run(title || '', JSON.stringify(messages || []), JSON.stringify(metadata || {}), now, sid);
  } else {
    db.prepare('INSERT INTO sessions (id, user_id, title, messages, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(sid, req.userId || null, title || '', JSON.stringify(messages || []), JSON.stringify(metadata || {}), now, now);
  }
  res.json({ id: sid, ok: true });
});

app.get('/api/sessions/:id', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not_found' });
  res.json({ ...s, messages: safeJsonParse(s.messages, []), metadata: safeJsonParse(s.metadata, {}) });
});

app.delete('/api/sessions/:id', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Memories ──
app.get('/api/memories', auth, (req, res) => {
  const { action, query } = req.query;
  const limit = parseInt(req.query.limit) || 50;
  let rows;
  if (action === 'search' && query) {
    if (req.userId) {
      rows = db.prepare('SELECT * FROM memories WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT ?')
        .all(req.userId, `%${query}%`, `%${query}%`, limit);
    } else {
      rows = db.prepare('SELECT * FROM memories WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT ?')
        .all(`%${query}%`, `%${query}%`, limit);
    }
  } else {
    if (req.userId) {
      rows = db.prepare('SELECT * FROM memories WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?').all(req.userId, limit);
    } else {
      rows = db.prepare('SELECT * FROM memories ORDER BY updated_at DESC LIMIT ?').all(limit);
    }
  }
  res.json(rows);
});

app.post('/api/memories', auth, requireSubscription(), (req, res) => {
  const { id, title, content, category, scope } = req.body;
  const mid = id || randomUUID();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM memories WHERE id = ?').get(mid);

  if (existing) {
    db.prepare('UPDATE memories SET title = ?, content = ?, category = ?, scope = ?, updated_at = ? WHERE id = ?')
      .run(title, content, category || 'general', scope || 'project', now, mid);
  } else {
    db.prepare('INSERT INTO memories (id, user_id, title, content, category, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(mid, req.userId || null, title, content, category || 'general', scope || 'project', now, now);
  }
  res.json({ id: mid, ok: true });
});

app.delete('/api/memories/:id', auth, (req, res) => {
  db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Webhook (with forwarding) ──
app.post('/api/webhook/:channel', async (req, res) => {
  const { channel } = req.params;
  const payload = req.body;
  const now = new Date().toISOString();

  // Store locally
  db.prepare('INSERT INTO webhook_logs (id, channel, payload, received_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), channel, JSON.stringify(payload), now);

  // Broadcast to WebSocket clients
  broadcast({ type: 'webhook', channel, payload, timestamp: now });

  // Forward to real services (fire-and-forget)
  const forwardResults = await forwardWebhook(channel, payload);

  res.json({
    ok: true,
    channel,
    forwarded: forwardResults.length > 0 ? forwardResults : undefined,
  });
});

app.get('/api/webhook/:channel', auth, (req, res) => {
  const logs = db.prepare('SELECT * FROM webhook_logs WHERE channel = ? ORDER BY received_at DESC LIMIT 50')
    .all(req.params.channel);
  res.json(logs);
});

// ── Webhook Config Management ──
app.get('/api/webhook-config', auth, (req, res) => {
  res.json(webhookConfig);
});

app.post('/api/webhook-config', auth, (req, res) => {
  const { channel } = req.body;
  if (!channel) return res.status(400).json({ error: 'channel required' });

  webhookConfig[channel] = {
    slack: req.body.slack || webhookConfig[channel]?.slack,
    discord: req.body.discord || webhookConfig[channel]?.discord,
    github: req.body.github || webhookConfig[channel]?.github,
    url: req.body.url || webhookConfig[channel]?.url,
    headers: req.body.headers || webhookConfig[channel]?.headers,
    slackText: req.body.slackText || webhookConfig[channel]?.slackText,
  };

  // Clean up null/undefined
  for (const k of Object.keys(webhookConfig[channel])) {
    if (webhookConfig[channel][k] == null) delete webhookConfig[channel][k];
  }
  if (Object.keys(webhookConfig[channel]).length === 0) {
    delete webhookConfig[channel];
  }

  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(webhookConfig, null, 2));
  } catch (e) {
    console.warn('[Webhooks] Failed to save config:', e.message);
  }

  broadcast({ type: 'webhook-config-updated', config: webhookConfig });
  res.json({ ok: true, config: webhookConfig });
});

// ====== Tenant Manager ======
const tenantManager = new TenantManager(db);

// Serve SaaS Web Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(resolve(__dirname, 'web-platform', 'public', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(resolve(__dirname, 'web-platform', 'public', 'index.html'));
});

// ── Tenant CRUD ──
app.get('/api/tenants', auth, (req, res) => {
  res.json(tenantManager.listTenants());
});

app.get('/api/tenants/:id', auth, (req, res) => {
  const t = tenantManager.getTenant(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  res.json(t);
});

app.post('/api/tenants', auth, (req, res) => {
  const created = tenantManager.createTenant(req.body);
  res.status(201).json(created);
});

app.put('/api/tenants/:id', auth, (req, res) => {
  const updated = tenantManager.updateTenant(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json(updated);
});

app.delete('/api/tenants/:id', auth, (req, res) => {
  const ok = tenantManager.deleteTenant(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// ── Tenant Quota & Usage ──
app.get('/api/tenants/:id/quota', auth, (req, res) => {
  res.json({
    api_call: tenantManager.checkQuota(req.params.id, 'api_call'),
    storage: tenantManager.checkQuota(req.params.id, 'storage'),
    session: tenantManager.checkQuota(req.params.id, 'session'),
  });
});

app.post('/api/tenants/:id/usage', auth, (req, res) => {
  const { metric, value } = req.body;
  const result = tenantManager.trackUsage(req.params.id, metric, value);
  res.json(result);
});

app.get('/api/tenants/:id/usage', auth, (req, res) => {
  const stats = tenantManager.getUsageStats(req.params.id, parseInt(req.query.days) || 30);
  res.json(stats);
});

app.get('/api/tenants/:id/billing', auth, (req, res) => {
  const bill = tenantManager.calculateBilling(req.params.id);
  if (!bill) return res.status(404).json({ error: 'not_found' });
  res.json(bill);
});

// ── Billing Overview (aggregated) ──
app.get('/api/billing', auth, (req, res) => {
  const tenants = tenantManager.listTenants();
  const planPricing = {
    free:      { base: 0,   apiCall: 0,      storage: 0,    label: '免费计划', sessions: 50,   apiQuota: 1000,    storageQuota: 100 },
    pro:       { base: 29,  apiCall: 0.001,  storage: 0.05, label: '专业版',   sessions: 200,  apiQuota: 10000,   storageQuota: 1024 },
    enterprise:{ base: 99,  apiCall: 0.0005, storage: 0.02, label: '企业版',   sessions: 99999, apiQuota: 999999,  storageQuota: 10240 },
  };

  const overview = { totalTenants: 0, free: 0, pro: 0, enterprise: 0, totalApiCalls: 0, totalStorageMb: 0, estimatedMRR: 0 };
  const tenantBills = tenants.map(t => {
    const bill = tenantManager.calculateBilling(t.id);
    const usage = tenantManager.getUsageStats(t.id, 30);
    const quota = {
      api_call: tenantManager.checkQuota(t.id, 'api_call'),
      storage:  tenantManager.checkQuota(t.id, 'storage'),
      session:  tenantManager.checkQuota(t.id, 'session'),
    };

    overview.totalTenants++;
    if (t.plan === 'free') overview.free++;
    else if (t.plan === 'pro') overview.pro++;
    else if (t.plan === 'enterprise') overview.enterprise++;
    overview.totalApiCalls += usage.api_call?.total || 0;
    overview.totalStorageMb += t.storage_used_mb || 0;
    overview.estimatedMRR += bill?.total || 0;

    return { id: t.id, name: t.name, email: t.email, plan: t.plan, status: t.status,
      apiCallsUsed: t.api_calls_used || 0, apiCallsQuota: t.quota_api_calls || 0,
      storageUsedMb: Math.round((t.storage_used_mb || 0) * 100) / 100,
      storageQuotaMb: t.quota_storage_mb || 0,
      sessionsUsed: t.sessions_used || 0, sessionsQuota: t.quota_sessions || 0,
      usage, quota, bill,
      created_at: t.created_at, updated_at: t.updated_at,
    };
  });

  overview.estimatedMRR = Math.round(overview.estimatedMRR * 100) / 100;
  res.json({ overview, tenants: tenantBills, plans: planPricing });
});

// ── Tenant Settings ──
app.get('/api/tenants/:id/settings', auth, (req, res) => {
  res.json(tenantManager.getSettings(req.params.id));
});

app.put('/api/tenants/:id/settings', auth, (req, res) => {
  const settings = tenantManager.updateSettings(req.params.id, req.body);
  res.json(settings);
});

// ====== Slack Bot ======
const slackBot = createSlackBot({
  token: process.env.SLACK_BOT_TOKEN || '',
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
});

// ====== CI Integration ======
const ci = createCiIntegration({
  githubToken: process.env.GITHUB_TOKEN || '',
  jenkinsUrl: process.env.JENKINS_URL || '',
  jenkinsUser: process.env.JENKINS_USER || '',
  jenkinsToken: process.env.JENKINS_TOKEN || '',
});

// ── Slack Webhook Receiver ──
// Slack sends POST to /api/slack/events with JSON body
app.post('/api/slack/events', async (req, res) => {
  try {
    const verified = slackBot.verifySignature(
      JSON.stringify(req.body),
      req.headers
    );
    if (!verified) return res.status(401).json({ error: 'invalid_signature' });

    const result = await slackBot.handleEvent(req.body);
    if (result) res.json(result);
    else res.status(200).end();
  } catch (err) {
    console.error('[Slack] Event error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Slack Interactive (button clicks, modals) ──
app.post('/api/slack/interactive', async (req, res) => {
  try {
    // Slack sends interactive payloads as form-encoded "payload" param
    const payload = req.body.payload ? safeJsonParse(req.body.payload, req.body) : req.body;
    const result = await slackBot._handleInteractive(
      payload.actions?.[0] || {},
      payload
    );
    if (result) res.json(result);
    else res.status(200).end();
  } catch (err) {
    console.error('[Slack] Interactive error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Slack Slash Command ──
app.post('/api/slack/command', async (req, res) => {
  try {
    const result = await slackBot._handleCommand(req.body);
    res.json(result);
  } catch (err) {
    console.error('[Slack] Command error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Slack: Send message (from AI agent) ──
app.post('/api/slack/send', auth, async (req, res) => {
  try {
    const { channel, text, blocks } = req.body;
    const result = await slackBot.sendMessage(channel, text, blocks);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Slack: Send notification ──
app.post('/api/slack/notify', auth, async (req, res) => {
  try {
    const { channel, title, fields, color } = req.body;
    const result = await slackBot.sendNotification(channel, title, fields, color);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CI: Trigger GitHub workflow ──
app.post('/api/ci/github/trigger', auth, async (req, res) => {
  try {
    const { owner, repo, workflowId, ref, inputs } = req.body;
    const result = await ci.triggerGitHubWorkflow(owner, repo, workflowId, ref, inputs);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CI: List GitHub workflow runs ──
app.get('/api/ci/github/runs', auth, async (req, res) => {
  try {
    const { owner, repo, workflow_id, branch, status, per_page } = req.query;
    const runs = await ci.listWorkflowRuns(owner, repo, {
      workflowId: workflow_id,
      branch,
      status,
      perPage: parseInt(per_page) || 10,
    });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CI: Get workflow run detail ──
app.get('/api/ci/github/runs/:owner/:repo/:runId', auth, async (req, res) => {
  try {
    const run = await ci.getWorkflowRun(req.params.owner, req.params.repo, req.params.runId);
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CI: Get workflow jobs ──
app.get('/api/ci/github/runs/:owner/:repo/:runId/jobs', auth, async (req, res) => {
  try {
    const jobs = await ci.getWorkflowJobs(req.params.owner, req.params.repo, req.params.runId);
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CI: Cancel workflow run ──
app.post('/api/ci/github/cancel', auth, async (req, res) => {
  try {
    const { owner, repo, runId } = req.body;
    const result = await ci.cancelWorkflowRun(owner, repo, runId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CI: Trigger Jenkins ──
app.post('/api/ci/jenkins/trigger', auth, async (req, res) => {
  try {
    const { jobName, params } = req.body;
    const result = await ci.triggerJenkinsJob(jobName, params);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CI: Generic webhook trigger ──
app.post('/api/ci/webhook', auth, async (req, res) => {
  try {
    const { url, payload } = req.body;
    const result = await ci.triggerCiWebhook(url, payload);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Scheduler CRUD ──
app.get('/api/schedules', auth, (req, res) => {
  const { status } = req.query;
  res.json(scheduler.listSchedules(status || null));
});

app.get('/api/schedules/:id', auth, (req, res) => {
  const sched = scheduler.getSchedule(req.params.id);
  if (!sched) return res.status(404).json({ error: 'not_found' });
  res.json(sched);
});

app.post('/api/schedules', auth, (req, res) => {
  const { name, cronExpr, actionType, actionConfig, maxRetries } = req.body;
  if (!name || !cronExpr) return res.status(400).json({ error: 'name and cronExpr required' });
  const created = scheduler.createSchedule({ name, cronExpr, actionType, actionConfig, maxRetries });
  res.status(201).json(created);
});

app.put('/api/schedules/:id', auth, (req, res) => {
  const updated = scheduler.updateSchedule(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json(updated);
});

app.delete('/api/schedules/:id', auth, (req, res) => {
  const ok = scheduler.deleteSchedule(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

app.post('/api/schedules/:id/trigger', auth, async (req, res) => {
  const result = await scheduler.triggerNow(req.params.id);
  res.json(result);
});

app.get('/api/schedules/:id/logs', auth, (req, res) => {
  const logs = scheduler.getLogs(req.params.id, parseInt(req.query.limit) || 50);
  res.json(logs);
});

// ====== Agent Chat (for bot gateways) ======

async function deepseekChat(messages) {
  const res = await fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: 2048,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('DeepSeek API ' + res.status + ': ' + err.slice(0, 200));
  }
  const data = await res.json();
  if (!data.choices || !data.choices[0]) {
    throw new Error('DeepSeek returned empty response: ' + JSON.stringify(data).slice(0, 200));
  }
  return data.choices[0].message.content;
}

app.post('/api/agent/chat', auth, requireSubscription('personal', true), async (req, res) => {
  const { message, userId, userName, conversationId, platform } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }
  if (!DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: 'DeepSeek API key not configured on server' });
  }

  try {
    const convId = conversationId || 'bot-' + (userId || 'anon');
    const label = (platform ? platform + ': ' : '') + (userName || userId || 'User');

    // Get conversation history from DB
    const history = db.prepare(
      'SELECT messages FROM conversations WHERE id = ?'
    ).get(convId) || { messages: '[]' };
    
    let prevMessages = [];
    if (history && history.messages) {
      try { prevMessages = JSON.parse(history.messages); }
      catch(e) { prevMessages = []; }
    }

    const systemPrompt = `You are \u7075\u5883 (LingJing), an AI coding assistant. Reply concisely in the user's language.`;
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...prevMessages.slice(-20), // last 20 messages for context
      { role: 'user', content: message },
    ];

    const reply = await deepseekChat(llmMessages);
    
    // Save conversation
    const newMessages = [
      ...prevMessages.slice(-40),
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ];
    db.prepare(
      'INSERT OR REPLACE INTO conversations (id, messages, updated_at) VALUES (?, ?, ?)'
    ).run(convId, JSON.stringify(newMessages), new Date().toISOString());

    console.log('[Agent] ' + label + ': ' + message.slice(0, 80) + ' -> ' + reply.slice(0, 80));
    // Track API call usage for quota
    if (req.userId) incrementDailyApiCalls(req.userId);
    res.json({ reply, conversationId: convId });

  } catch (err) {
    console.error('[Agent] Error:', err.message);
    res.status(500).json({ reply: 'Internal error: ' + err.message.slice(0, 200) });
  }
});

// ====== Push Notifications (Expo) ======
const NOTIFICATIONS_PATH = resolve(__dirname, 'push-tokens.json');

function loadPushTokens() {
  try {
    if (existsSync(NOTIFICATIONS_PATH)) {
      return JSON.parse(readFileSync(NOTIFICATIONS_PATH, 'utf8'));
    }
  } catch {}
  return [];
}

function savePushTokens(tokens) {
  writeFileSync(NOTIFICATIONS_PATH, JSON.stringify(tokens, null, 2));
}

// POST /api/notifications/register — Mobile registers Expo push token
app.post('/api/notifications/register', auth, (req, res) => {
  const { pushToken, platform, deviceName } = req.body;
  if (!pushToken || typeof pushToken !== 'string') {
    return res.status(400).json({ error: 'pushToken required' });
  }

  const tokens = loadPushTokens();
  // Deduplicate: remove existing entry with same token or same device
  const idx = tokens.findIndex(t => t.pushToken === pushToken);
  if (idx >= 0) {
    tokens[idx] = {
      pushToken,
      platform: platform || 'unknown',
      deviceName: deviceName || 'Unknown',
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      userId: req.user?.id || 'unknown',
    };
  } else {
    tokens.push({
      pushToken,
      platform: platform || 'unknown',
      deviceName: deviceName || 'Unknown',
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      userId: req.user?.id || 'unknown',
    });
  }
  savePushTokens(tokens);

  console.log(`[Push] Token registered: ${deviceName} (${platform}) user=${req.user?.id}`);
  res.json({ ok: true, count: tokens.length });
});

// POST /api/notifications/send — Send push notification to all registered devices
app.post('/api/notifications/send', auth, async (req, res) => {
  const { title, body, data } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body required' });
  }

  const tokens = loadPushTokens();
  if (tokens.length === 0) {
    return res.json({ ok: true, sent: 0, message: 'No registered devices' });
  }

  // Send via Expo Push API
  const messages = tokens.map(t => ({
    to: t.pushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
    priority: 'high',
  }));

  try {
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await resp.json();
    // Update lastSeen for successfully sent
    if (result.data) {
      result.data.forEach((ticket, i) => {
        if (ticket.status === 'ok' && tokens[i]) {
          tokens[i].lastSeen = new Date().toISOString();
        }
      });
      savePushTokens(tokens);
    }

    console.log(`[Push] Sent to ${tokens.length} devices: "${title}"`);
    res.json({ ok: true, sent: tokens.length, tickets: result.data });
  } catch (err) {
    console.error('[Push] Send failed:', err.message);
    res.status(500).json({ error: 'Push send failed: ' + err.message });
  }
});

// GET /api/notifications/tokens — List registered devices (admin)
app.get('/api/notifications/tokens', auth, (req, res) => {
  const tokens = loadPushTokens();
  // Mask tokens for security
  const masked = tokens.map(t => ({
    ...t,
    pushToken: t.pushToken.substring(0, 8) + '...' + t.pushToken.slice(-4),
  }));
  res.json({ count: tokens.length, devices: masked });
});

// POST /api/notifications/version-update — CI/CD updates versions.json
app.post('/api/notifications/version-update', auth, (req, res) => {
  const { version, size, releaseNotes } = req.body;
  if (!version) return res.status(400).json({ error: 'version required' });

  // Search for existing versions.json using same paths as readVersionInfo()
  const searchPaths = [
    '/root/lingjing-update/data/versions.json',
    '/var/www/update-server/data/versions.json',
    '/opt/lingjing-update/data/versions.json',
    resolve(__dirname, '..', 'update-server', 'data', 'versions.json'),
    resolve(__dirname, '..', '..', 'var', 'www', 'update-server', 'data', 'versions.json'),
  ];

  let versionsPath = null;
  let versions = [];
  for (const p of searchPaths) {
    if (existsSync(p)) {
      versionsPath = p;
      try {
        versions = JSON.parse(readFileSync(p, 'utf8'));
        if (!Array.isArray(versions)) versions = [];
        break;
      } catch { continue; }
    }
  }
  if (!versionsPath) {
    return res.status(404).json({ error: 'versions.json not found' });
  }

  const idx = versions.findIndex(v => v.version === version);
  const entry = {
    version,
    releaseDate: new Date().toISOString(),
    releaseNotes: releaseNotes || `Auto-deployed ${version}`,
    files: {
      apk: `https://ide.zhejiangjinmo.com/downloads/LingJing-Mobile-${version.replace('v', '').replace('-mobile', '')}.apk`,
      platform: 'android',
    },
    size: size || 0,
  };

  if (idx >= 0) {
    versions[idx] = { ...versions[idx], ...entry };
  } else {
    versions.splice(1, 0, entry);
  }

  writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
  console.log(`[Version] Updated ${versionsPath} with ${version}`);
  res.json({ ok: true, version });
});

// ====== Scheduler ======
const scheduler = new CloudScheduler(db, {
  tickInterval: 10000,   // check every 10 seconds
  maxRetries: 3,
  retryBaseMs: 1000,
});

// Forward scheduler webhooks to real services
scheduler.on('webhook', async (channel, payload) => {
  const results = await forwardWebhook(channel, payload);
  console.log(`[Scheduler] Webhook forwarded to ${channel}:`, results.map(r => r.service).join(','));
});

scheduler.start();

// ====== HTTP Server + WebSocket ======
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

wss.on('connection', (ws, req) => {
  // Support api_key query param
  const url = new URL(req.url, `http://${req.headers.host}`);
  const apiKey = url.searchParams.get('api_key');
  const token = url.searchParams.get('token');
  
  let authorized = false;
  let wsUserId = null;
  let wsDeviceId = null;
  let wsIsDesktop = false;
  
  if (apiKey === API_KEY) authorized = true;
  if (token) {
    const payload = verifyJWT(token);
    if (payload) {
      authorized = true;
      wsUserId = payload.sub;
      if (payload.role === 'user') {
        wsUserId = payload.sub;
        wsDeviceId = url.searchParams.get('device_id') || null;
      }
    }
  }
  
  if (!authorized) {
    ws.close(4001, 'unauthorized');
    return;
  }

  clients.add(ws);
  console.log(`WS client connected (total: ${clients.size})`);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      
      // Heartbeat
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      // Desktop registration for relay
      if (data.type === 'desktop:register') {
        const { deviceId } = data;
        if (deviceId && wsUserId) {
          wsDeviceId = deviceId;
          wsIsDesktop = true;
          registerDesktopRelay(wsUserId, deviceId, ws);
          ws.send(JSON.stringify({ type: 'desktop:registered', deviceId, ok: true }));
        } else {
          ws.send(JSON.stringify({ type: 'desktop:registered', ok: false, error: 'missing_userId_or_deviceId' }));
        }
        return;
      }
      
      // Desktop heartbeat
      if (data.type === 'desktop:heartbeat' && wsUserId && wsDeviceId) {
        try {
          const now = new Date().toISOString();
          db.prepare('UPDATE user_devices SET is_online = 1, last_sync_at = ? WHERE id = ? AND user_id = ?')
            .run(now, wsDeviceId, wsUserId);
        } catch (e) { /* best-effort */ }
        ws.send(JSON.stringify({ type: 'desktop:heartbeat:ack' }));
        return;
      }
      
      // Relay: send message to a desktop device
      if (data.type === 'relay:to-desktop') {
        const { targetDeviceId, payload, correlationId } = data;
        if (!targetDeviceId || !wsUserId) {
          ws.send(JSON.stringify({ type: 'relay:ack', ok: false, error: 'missing_target', correlationId }));
          return;
        }
        const targetWs = findDesktopWs(wsUserId, targetDeviceId);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: 'relay:from-mobile',
            fromUserId: wsUserId,
            payload,
            correlationId,
            timestamp: new Date().toISOString(),
          }));
          ws.send(JSON.stringify({ type: 'relay:ack', ok: true, correlationId }));
        } else {
          ws.send(JSON.stringify({ type: 'relay:ack', ok: false, error: 'desktop_offline', correlationId }));
        }
        return;
      }
      
      // Relay: desktop replies to mobile
      if (data.type === 'relay:to-mobile') {
        const { correlationId, payload } = data;
        for (const ws2 of clients) {
          if (ws2 !== ws && ws2._wsUserId === wsUserId && ws2.readyState === 1) {
            try {
              ws2.send(JSON.stringify({
                type: 'relay:from-desktop',
                deviceId: wsDeviceId,
                payload,
                correlationId,
                timestamp: new Date().toISOString(),
              }));
            } catch (e) { /* ignore */ }
          }
        }
        ws.send(JSON.stringify({ type: 'relay:ack', ok: true, correlationId }));
        return;
      }
      
      // Desktop: list online desktops for this user
      if (data.type === 'desktop:list') {
        if (!wsUserId) {
          ws.send(JSON.stringify({ type: 'desktop:list', ok: false, error: 'not_authenticated' }));
          return;
        }
        try {
          const desktops = db.prepare(`
            SELECT id, name, type, os, last_sync_at, is_online
            FROM user_devices
            WHERE user_id = ? AND type = 'desktop'
            ORDER BY last_sync_at DESC
          `).all(wsUserId);
          ws.send(JSON.stringify({
            type: 'desktop:list',
            ok: true,
            desktops: desktops.map(d => ({
              deviceId: d.id,
              name: d.name,
              os: d.os,
              lastSeen: d.last_sync_at,
              isOnline: !!d.is_online,
            })),
          }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'desktop:list', ok: false, error: e.message }));
        }
        return;
      }

      // Sync (existing functionality)
      if (data.type === 'sync') {
        broadcast({ type: 'sync', from: data.id, payload: data.payload });
      } else if (data.type === 'sync:push') {
        const userId = data.userId;
        const dataType = data.dataType || 'unknown';
        const payload = data.payload;
        if (userId && payload) {
          const recordId = randomUUID();
          const now = new Date().toISOString();
          try {
            db.prepare('INSERT INTO sync_records (id, user_id, timestamp, data_type, operation, status, size, device_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(recordId, userId, now, dataType, 'push', 'success', JSON.stringify(payload).length, data.deviceId || '');
            if (dataType === 'session' && payload.id) {
              try {
                db.prepare('INSERT OR REPLACE INTO sessions (id, title, messages, metadata, updated_at) VALUES (?, ?, ?, ?, ?)')
                  .run(payload.id, payload.title || '', JSON.stringify(payload.messages || []), JSON.stringify(payload.metadata || {}), now);
              } catch (e) { }
            }
            if (dataType === 'memory' && payload.title) {
              try {
                const memId = payload.id || randomUUID();
                const existing = db.prepare('SELECT id FROM memories WHERE id = ?').get(memId);
                if (existing) {
                  db.prepare('UPDATE memories SET content = ?, category = ?, scope = ?, updated_at = ? WHERE id = ?')
                    .run(payload.content || '', payload.category || 'general', payload.scope || 'project', now, memId);
                } else {
                  db.prepare('INSERT INTO memories (id, title, content, category, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    .run(memId, payload.title, payload.content || '', payload.category || 'general', payload.scope || 'project', now, now);
                }
              } catch (e) { }
            }
            ws.send(JSON.stringify({ type: 'sync:push:ack', recordId, timestamp: now }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'sync:push:error', error: e.message }));
          }
        }
      } else if (data.type === 'sync:pull') {
        const userId = data.userId;
        const dataType = data.dataType || 'all';
        const result = { sessions: [], memories: [] };
        try {
          if (dataType === 'all' || dataType === 'sessions') {
            result.sessions = db.prepare('SELECT id, title, messages, metadata, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 100').all();
          }
          if (dataType === 'all' || dataType === 'memories') {
            result.memories = db.prepare('SELECT id, title, content, category, scope, created_at, updated_at FROM memories ORDER BY updated_at DESC LIMIT 100').all();
          }
        } catch (e) { }
        ws.send(JSON.stringify({ type: 'sync:pull:data', dataType, data: result }));
      } else if (data.type === 'subscribe') {
        const channel = data.channel || 'all';
        ws._channels = ws._channels || [];
        ws._channels.push(channel);
        ws.send(JSON.stringify({ type: 'subscribed', channel }));
      }
    } catch (e) { }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (wsIsDesktop && wsUserId && wsDeviceId) {
      unregisterDesktopRelay(wsUserId, wsDeviceId, ws);
    }
    console.log(`WS client disconnected (total: ${clients.size})`);
  });

  ws._wsUserId = wsUserId;
  ws._wsDeviceId = wsDeviceId;

  ws.send(JSON.stringify({ type: 'welcome', server: 'lingjing-cloud', version: '2.0.0' }));
});

// ── Desktop relay helpers ──
// userId → Set<{ ws, deviceId }>
const desktopRelays = new Map();

function registerDesktopRelay(userId, deviceId, ws) {
  if (!desktopRelays.has(userId)) desktopRelays.set(userId, new Set());
  desktopRelays.get(userId).add({ ws, deviceId });
  try {
    const now = new Date().toISOString();
    db.prepare('UPDATE user_devices SET is_online = 1, last_sync_at = ? WHERE id = ? AND user_id = ?')
      .run(now, deviceId, userId);
  } catch (e) { }
  console.log(`[Relay] Desktop registered: ${deviceId.slice(0,12)}... for user ${userId.slice(0,12)}...`);
}

function unregisterDesktopRelay(userId, deviceId, ws) {
  const relays = desktopRelays.get(userId);
  if (!relays) return;
  for (const entry of relays) {
    if (entry.ws === ws || entry.deviceId === deviceId) {
      relays.delete(entry);
      break;
    }
  }
  if (relays.size === 0) desktopRelays.delete(userId);
  try {
    db.prepare('UPDATE user_devices SET is_online = 0 WHERE id = ? AND user_id = ?')
      .run(deviceId, userId);
  } catch (e) { }
  console.log(`[Relay] Desktop unregistered: ${deviceId.slice(0,12)}...`);
}

function findDesktopWs(userId, deviceId) {
  const relays = desktopRelays.get(userId);
  if (!relays) return null;
  for (const entry of relays) {
    if (entry.deviceId === deviceId && entry.ws.readyState === 1) return entry.ws;
  }
  return null;
}
// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  scheduler.stop();
  wss.close();
  closeDB(db);
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  scheduler.stop();
  wss.close();
  closeDB(db);
  server.close(() => process.exit(0));
});

// ====== Bot Gateways ======
let telegramBot = null;
let discordBot = null;

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const CLOUD_URL = process.env.CLOUD_URL || ('http://127.0.0.1:' + PORT);

if (TELEGRAM_TOKEN) {
  console.log('[Bots] Starting Telegram bot...');
  telegramBot = createTelegramBot(TELEGRAM_TOKEN, CLOUD_URL, API_KEY);
  telegramBot.start().catch(err => console.error('[TelegramBot] Fatal:', err.message));
} else {
  console.log('[Bots] Telegram bot disabled (no TELEGRAM_BOT_TOKEN)');
}

if (DISCORD_TOKEN) {
  console.log('[Bots] Starting Discord bot...');
  discordBot = createDiscordBot(DISCORD_TOKEN, CLOUD_URL, API_KEY);
  discordBot.start().catch(err => console.error('[DiscordBot] Fatal:', err.message));
} else {
  console.log('[Bots] Discord bot disabled (no DISCORD_BOT_TOKEN)');
}

// ====== Cloud Management API Routes ======
function getUserId(req) { return req.user?.id || 'default-user'; }

app.get('/api/user/info', auth, (req, res) => {
  res.json({ id: getUserId(req), username: 'demo_user', email: 'demo@lingjing.com', registeredAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(), passwordStrength: 'strong', twoFactorEnabled: false });
});
app.get('/api/user/security', auth, (req, res) => {
  res.json({ twoFactorEnabled: false, sessionTimeout: 60, loginNotification: true, trustedDevices: [] });
});
app.get('/api/user/login-history', auth, (req, res) => { res.json([]); });
app.get('/api/devices', auth, (req, res) => { res.json([]); });
app.post('/api/devices/register', auth, (req, res) => {
  const { name, type, os } = req.body;
  const deviceId = randomUUID();
  const now = new Date().toISOString();
  res.json({ id: deviceId, name, type, os, lastSyncAt: now, syncStatus: 'synced', boundAt: now });
});
app.post('/api/devices/auth-code', auth, (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const now = new Date();
  res.json({ code, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 600000).toISOString() });
});
app.get('/api/subscription', auth, requireSubscription(), (req, res) => {
  try {
    const sub = req.subscription || { planId: 'free', planName: '免费版', status: 'active', limits: { apiCalls: 100, storage: 100 }, features: [], usage: { apiCalls: 0, storageFiles: 0, apiKeys: 0 } };
    res.json({
      id: sub.subscriptionId || null,
      userId: req.userId,
      planId: sub.planId,
      planName: sub.planName,
      status: sub.status,
      startedAt: sub.subscriptionId ? sub.expiresAt : null,
      expiresAt: sub.expiresAt || null,
      autoRenew: sub.status === 'active' && sub.planId !== 'free',
      features: sub.features,
      limits: sub.limits,
      usage: sub.usage || { apiCalls: getDailyApiCalls(req.userId), storageFiles: 0, apiKeys: 0 },
    });
  } catch (err) {
    console.error('[Subscription] /api/subscription error:', err.message);
    res.json({ planId: 'free', planName: '免费版', status: 'active' });
  }
});
app.get('/api/subscription/plans', auth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM plans ORDER BY price ASC').all();
    const plans = rows.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      billingCycle: p.billing_cycle,
      recommended: !!p.recommended,
      features: JSON.parse(p.features || '[]'),
      limits: JSON.parse(p.limits || '{}'),
    }));
    res.json(plans);
  } catch (err) {
    console.error('[Subscription] /api/subscription/plans error:', err.message);
    res.json([]);
  }
});
app.get('/api/sync/status', auth, (req, res) => {
  try {
    const userId = req.userId;
    const lastRecord = userId
      ? db.prepare('SELECT timestamp, status FROM sync_records WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1').get(userId)
      : db.prepare('SELECT timestamp, status FROM sync_records ORDER BY timestamp DESC LIMIT 1').get();
    const totalRecords = userId
      ? db.prepare('SELECT COUNT(*) as count FROM sync_records WHERE user_id = ?').get(userId)
      : db.prepare('SELECT COUNT(*) as count FROM sync_records').get();
    const wsClients = clients.size;
    res.json({
      enabled: true,
      lastSyncAt: lastRecord?.timestamp || null,
      status: lastRecord?.status || 'idle',
      progress: null,
      totalRecords: totalRecords?.count || 0,
      connectedClients: wsClients,
    });
  } catch (err) {
    console.error('[Sync] status error:', err.message);
    res.json({ enabled: true, lastSyncAt: null, status: 'unknown', progress: null });
  }
});
app.post('/api/sync/now', auth, (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.json({ success: true, message: '同步已开始（匿名）' });
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const dataTypes = req.body?.dataTypes || ['sessions', 'memories', 'config'];
    db.prepare('INSERT INTO sync_records (id, user_id, timestamp, data_type, operation, status, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, now, dataTypes.join(','), 'push', 'pending', req.deviceId || '');
    // Process sync in background
    setTimeout(() => {
      try {
        db.prepare('UPDATE sync_records SET status = ? WHERE id = ?').run('success', id);
        broadcast({ type: 'sync:complete', userId, recordId: id, timestamp: now });
      } catch (e) { /* ignore */ }
    }, 100);
    res.json({ success: true, message: '同步已开始', recordId: id });
  } catch (err) {
    console.error('[Sync] now error:', err.message);
    res.json({ success: true, message: '同步已开始' });
  }
});
app.get('/api/sync/history', auth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.userId;
    let records;
    if (userId) {
      records = db.prepare('SELECT * FROM sync_records WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(userId, limit, offset);
    } else {
      records = db.prepare('SELECT * FROM sync_records ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset);
    }
    res.json(records.map(r => ({
      id: r.id,
      userId: r.user_id,
      dataType: r.data_type,
      operation: r.operation,
      status: r.status,
      size: r.size,
      deviceId: r.device_id,
      timestamp: r.timestamp,
    })));
  } catch (err) {
    console.error('[Sync] history error:', err.message);
    res.json([]);
  }
});
app.get('/api/storage/stats', auth, requireSubscription(), (req, res) => {
  try {
    const sub = req.subscription || {};
    const storageLimit = (sub.limits && sub.limits.storage) || 100;
    const files = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total FROM storage_files').get() || { count: 0, total: 0 };
    const usedMb = Math.round(files.total / (1024 * 1024) * 100) / 100;
    res.json({ total: storageLimit, used: usedMb, available: Math.max(0, storageLimit - usedMb), files: files.count, breakdown: { files: usedMb, other: 0 } });
  } catch (err) {
    console.error('[Storage] stats error:', err.message);
    res.json({ total: 100, used: 0, available: 100 });
  }
});
app.get('/api/storage/files', auth, (req, res) => { res.json({ files: [], total: 0 }); });
app.get('/api/api-keys', auth, requireSubscription(), (req, res) => {
  try {
    const keys = db.prepare('SELECT id, name, permissions, created_at, expires_at, status, last_used_at, call_count, error_count FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(req.userId || '');
    res.json({ keys: keys.map(function(k) { return Object.assign({}, k, { permissions: JSON.parse(k.permissions || '[]') }); }), total: keys.length });
  } catch (err) {
    console.error('[API Keys] list error:', err.message);
    res.json({ keys: [], total: 0 });
  }
});
app.post('/api/api-keys', auth, requireSubscription(), (req, res) => {
  try {
    const { name, permissions, expiresAt } = req.body;
    if (!name) return res.status(400).json({ error: 'name_required' });
    const sub = req.subscription || {};
    const keyLimit = (sub.limits && sub.limits.apiKeys) || 5;
    const existingCount = (db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND status = ?').get(req.userId || '', 'active') || {}).count || 0;
    if (existingCount >= keyLimit) {
      return res.status(429).json({ error: 'api_key_limit_exceeded', limit: keyLimit, message: 'API密钥数量已达上限(' + keyLimit + '个)' });
    }
    const keyId = randomUUID();
    const key = 'lj_' + randomUUID().replace(/-/g, '');
    const now = new Date().toISOString();
    db.prepare('INSERT INTO api_keys (id, user_id, name, key, permissions, created_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(keyId, req.userId, name, key, JSON.stringify(permissions || []), now, expiresAt || null, 'active');
    res.json({ id: keyId, name, key, maskedKey: key.substring(0, 8) + '...' + key.substring(key.length - 4), permissions: permissions || [], createdAt: now, expiresAt: expiresAt || null, status: 'active', callCount: 0, errorCount: 0 });
  } catch (err) {
    console.error('[API Keys] create error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});
app.delete('/api/api-keys/:keyId', auth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.keyId, req.userId || '');
    res.json({ success: result.changes > 0 });
  } catch (err) {
    console.error('[API Keys] delete error:', err.message);
    res.json({ success: false });
  }
});
app.get('/api/api-keys/stats', auth, requireSubscription(), (req, res) => {
  try {
    const stats = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active, COALESCE(SUM(call_count), 0) as totalCalls, COALESCE(SUM(error_count), 0) as totalErrors FROM api_keys WHERE user_id = ?').get('active', req.userId || '');
    res.json({ totalKeys: stats.total || 0, activeKeys: stats.active || 0, totalCalls: stats.totalCalls || 0, totalErrors: stats.totalErrors || 0, avgCallsPerDay: 0 });
  } catch (err) {
    console.error('[API Keys] stats error:', err.message);
    res.json({ totalKeys: 0, activeKeys: 0, totalCalls: 0, totalErrors: 0, avgCallsPerDay: 0 });
  }
});

console.log('[Cloud Management] API routes initialized');

server.listen(PORT, '0.0.0.0', () => {
  console.log(`灵境 Cloud Server v3 running on http://0.0.0.0:${PORT}`);
  console.log(`API Key: ${API_KEY}`);
  console.log(`JWT Secret: ${JWT_SECRET.slice(0, 8)}...`);
  console.log(`Webhook forwarding: ${Object.keys(webhookConfig).length} channels configured`);
  console.log(`Scheduler: running (active schedules: ${scheduler.listSchedules('active').length})`);
});
