/**
 * 灵境 Cloud Admin Management API
 * 管理后台专用 API 路由
 * 集成到 cloud-server，共享 SQLite 数据库
 */

import { randomUUID, createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { subscribe as subscribeLogs } from './log-stream.js';
import { safeCompare, base64url, hashPassword, verifyPassword, generateSalt } from './crypto-utils.js';
import { createRateLimiter } from './rate-limiter.js';

// ES module __dirname shim (for server.js-compatible path resolution)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeJsonParse(val, fallback) {
  if (val == null) return fallback;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

// Admin credentials (in production, use environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD_FILE = process.env.ADMIN_PASSWORD_FILE || '/root/lingjing-cloud/.admin-password.json';
const DEFAULT_PASSWORD_HASH = createHash('sha256').update('admin123').digest('hex');

function getAdminPasswordHash() {
  if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
  try {
    if (fs.existsSync(PASSWORD_FILE)) {
      const data = JSON.parse(fs.readFileSync(PASSWORD_FILE, 'utf8'));
      if (data.hash) return data.hash;
    }
  } catch (e) { /* ignore */ }
  return DEFAULT_PASSWORD_HASH;
}

function saveAdminPasswordHash(hash) {
  try {
    fs.writeFileSync(PASSWORD_FILE, JSON.stringify({ hash, updated_at: new Date().toISOString() }), 'utf8');
    return true;
  } catch (e) { return false; }
}

function isDefaultPassword() {
  return safeCompare(getAdminPasswordHash(), DEFAULT_PASSWORD_HASH);
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] JWT_SECRET environment variable is required in production');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET not set, using dev-only default');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'lingjing-jwt-secret-dev-only';

function signAdminJWT(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac('sha256', EFFECTIVE_JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyAdminJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = createHmac('sha256', EFFECTIVE_JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (!safeCompare(sig, expectedSig)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ====== 2.1: 通用基础设施 ======

function validateInput(rules, data) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors[field] = errors[field] || [];
      errors[field].push('required');
      continue;
    }
    if (value === undefined || value === null) continue;
    if (rule.type === 'string' && typeof value !== 'string') { errors[field] = errors[field] || []; errors[field].push('must be string'); }
    if (rule.type === 'number' && (typeof value !== 'number' || isNaN(value))) { errors[field] = errors[field] || []; errors[field].push('must be number'); }
    if (rule.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { errors[field] = errors[field] || []; errors[field].push('invalid email'); }
    if (rule.type === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) { errors[field] = errors[field] || []; errors[field].push('invalid uuid'); }
    if (rule.type === 'enum' && rule.enumValues && !rule.enumValues.includes(value)) { errors[field] = errors[field] || []; errors[field].push(`must be one of: ${rule.enumValues.join(',')}`); }
    if (rule.type === 'date' && isNaN(Date.parse(value))) { errors[field] = errors[field] || []; errors[field].push('invalid date'); }
    if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) { errors[field] = errors[field] || []; errors[field].push(`min length ${rule.minLength}`); }
    if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) { errors[field] = errors[field] || []; errors[field].push(`max length ${rule.maxLength}`); }
    if (rule.min !== undefined && typeof value === 'number' && value < rule.min) { errors[field] = errors[field] || []; errors[field].push(`min ${rule.min}`); }
    if (rule.max !== undefined && typeof value === 'number' && value > rule.max) { errors[field] = errors[field] || []; errors[field].push(`max ${rule.max}`); }
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) { errors[field] = errors[field] || []; errors[field].push('pattern mismatch'); }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

function parsePagination(query) {
  let page = Math.max(1, parseInt(query.page) || 1);
  let pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || query.limit) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function buildPaginatedResponse(data, page, pageSize, total) {
  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

function buildErrorResponse(error, detail, code) {
  const resp = { error };
  if (detail) resp.detail = detail;
  if (code) resp.code = code;
  return resp;
}

export function registerAdminAPI(app, db) {
  // ====== Global Admin Rate Limiter (60 req/min per IP) ======
  const apiRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 60,
    message: '请求过于频繁，请稍后重试',
  });

  // ====== Audit Log Middleware ======
  function auditLog(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
      try {
        db.prepare(
          'INSERT INTO audit_logs (user, ip, method, path, status_code, duration_ms, created_at) VALUES (?,?,?,?,?,?,?)'
        ).run(
          req.admin?.sub || req.admin?.username || '',
          req.ip || '',
          req.method || '',
          req.originalUrl || req.path || '',
          res.statusCode || 0,
          Date.now() - start,
          new Date().toISOString()
        );
      } catch (e) { /* audit log failure must not break response */ }
    });
    next();
  }

  // ====== Admin Auth Middleware ======
  function adminAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const payload = verifyAdminJWT(authHeader.slice(7));
    if (!payload || payload.role !== 'admin') {
      return res.status(401).json({ error: 'invalid_token' });
    }
    req.admin = payload;
    next();
  }

  // ====== Reviewer Auth Middleware (admin or reviewer role) ======
  function reviewerAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const payload = verifyAdminJWT(authHeader.slice(7));
    if (!payload || (payload.role !== 'admin' && payload.role !== 'reviewer')) {
      return res.status(403).json({ error: 'forbidden', message: '需要审核权限' });
    }
    req.admin = payload;
    next();
  }

  // ====== Admin Login ======
  const loginRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 5, message: '登录尝试过多，请15分钟后重试' });
  app.post('/api/admin/login', loginRateLimit, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }
    
    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    
    const hash = createHash('sha256').update(password).digest('hex');
    if (!safeCompare(hash, getAdminPasswordHash())) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = signAdminJWT({
      sub: username,
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      token,
      user: { username, role: 'admin' },
      expiresIn: 24 * 60 * 60 * 1000,
      mustChangePassword: isDefaultPassword(),
    });
  });

  // ====== Apply rate limiting + audit log to all subsequent admin routes ======
  app.use('/api/admin', apiRateLimit, auditLog);

  // ====== Change Admin Password ======
  app.get('/api/admin/check-default-password', adminAuth, (req, res) => {
    res.json({ isDefault: isDefaultPassword() });
  });

  app.post('/api/admin/change-password', adminAuth, (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'currentPassword and newPassword required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: '新密码至少需要8个字符' });
      }
      if (newPassword.length > 128) {
        return res.status(400).json({ error: '新密码不能超过128个字符' });
      }

      const currentHash = createHash('sha256').update(currentPassword).digest('hex');
      if (currentHash !== getAdminPasswordHash()) {
        return res.status(401).json({ error: '当前密码不正确' });
      }

      const newHash = createHash('sha256').update(newPassword).digest('hex');
      if (!saveAdminPasswordHash(newHash)) {
        return res.status(500).json({ error: '保存密码失败' });
      }

      res.json({ ok: true, message: '密码已修改成功' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Dashboard Stats (real data from DB) ======
  app.get('/api/admin/stats', adminAuth, async (req, res) => {
    try {
      // Device stats: merge devices (JWT auth) + user_devices (IDE注册)
      let totalDevices = 0;
      let onlineDevices = 0;
      try {
        const d1 = db.prepare('SELECT COUNT(*) as count FROM devices').get()?.count || 0;
        const d2 = db.prepare('SELECT COUNT(*) as count FROM user_devices').get()?.count || 0;
        totalDevices = d1 + d2;
        const online2 = db.prepare("SELECT COUNT(*) as count FROM user_devices WHERE is_online = 1").get()?.count || 0;
        onlineDevices = online2;
      } catch (e) { /* tables may not exist */ }

      const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get()?.count || 0;
      const totalMemories = db.prepare('SELECT COUNT(*) as count FROM memories').get()?.count || 0;
      const totalWebhooks = db.prepare('SELECT COUNT(*) as count FROM webhook_logs').get()?.count || 0;
 const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
      
      // Subscription stats
      let subStats = { total: 0, active: 0, expired: 0, cancelled: 0 };
      try {
        subStats.total = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get()?.count || 0;
        subStats.active = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'").get()?.count || 0;
        subStats.expired = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'expired'").get()?.count || 0;
        subStats.cancelled = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled'").get()?.count || 0;
      } catch (e) { /* subscriptions table may not exist */ }

      // Payment stats
      let paymentStats = { total: 0, pending: 0, success: 0, failed: 0, totalRevenue: 0 };
      try {
        paymentStats.total = db.prepare('SELECT COUNT(*) as count FROM payments').get()?.count || 0;
        paymentStats.pending = db.prepare("SELECT COUNT(*) as count FROM payments WHERE payment_status = 'pending'").get()?.count || 0;
        paymentStats.success = db.prepare("SELECT COUNT(*) as count FROM payments WHERE payment_status = 'success'").get()?.count || 0;
        paymentStats.failed = db.prepare("SELECT COUNT(*) as count FROM payments WHERE payment_status = 'failed'").get()?.count || 0;
        const revenueResult = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_status = 'success'").get();
        paymentStats.totalRevenue = revenueResult?.total || 0;
      } catch (e) { /* payments table may not exist */ }

      // Recent activities
      const recentSessions = db.prepare('SELECT id, title, created_at FROM sessions ORDER BY created_at DESC LIMIT 5').all();
      const recentDevices = db.prepare('SELECT id, name, last_seen FROM devices ORDER BY last_seen DESC LIMIT 5').all();

      res.json({
        devices: { total: totalDevices, online: onlineDevices },
        users: { total: totalUsers },
        sessions: { total: totalSessions },
        memories: { total: totalMemories },
        webhooks: { total: totalWebhooks },
        subscriptions: subStats,
        payments: paymentStats,
        recentSessions,
        recentDevices,
        serverUptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
    }
  });

  // ====== Server Metrics (CPU/Memory/Disk) ======
  app.get('/api/admin/metrics', adminAuth, async (req, res) => {
    try {
      const cpus = os.cpus();
      const cpuLoad = os.loadavg();
      const cpuCores = cpus.length;

      const cpuUsage = cpus.map(cpu => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return Math.round((1 - idle / total) * 100);
      });
      const avgCpuUsage = Math.round(cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length);

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = Math.round((usedMem / totalMem) * 100);
      const processMem = process.memoryUsage();

      let disk = { total_mb: 0, used_mb: 0, available_mb: 0, usage_percent: 0 };
      if (process.platform !== 'win32') {
        try {
          const { execSync } = await import('node:child_process');
          const stdout = execSync('df -m /', { timeout: 5000, encoding: 'utf8' });
          const parts = stdout.trim().split('\n')[1]?.split(/\s+/);
          if (parts && parts.length >= 6) {
            disk = {
              total_mb: parseInt(parts[1]) || 0,
              used_mb: parseInt(parts[2]) || 0,
              available_mb: parseInt(parts[3]) || 0,
              usage_percent: parseInt(parts[4].replace('%', '')) || 0
            };
          }
        } catch (e) { /* disk query failed, use default */ }
      }

      res.json({
          cpu: {
            cores: cpuCores,
            model: cpus[0]?.model || 'unknown',
            loadAverage: { '1m': Math.round(cpuLoad[0]*100)/100, '5m': Math.round(cpuLoad[1]*100)/100, '15m': Math.round(cpuLoad[2]*100)/100 },
            usagePercent: avgCpuUsage,
            perCore: cpuUsage,
          },
          memory: {
            total: totalMem, used: usedMem, free: freeMem, usagePercent: memUsagePercent,
            totalFormatted: formatBytes(totalMem), usedFormatted: formatBytes(usedMem), freeFormatted: formatBytes(freeMem),
          },
          disk,
          process: {
            rss: processMem.rss, heapTotal: processMem.heapTotal, heapUsed: processMem.heapUsed,
            rssFormatted: formatBytes(processMem.rss),
            heapTotalFormatted: formatBytes(processMem.heapTotal),
            heapUsedFormatted: formatBytes(processMem.heapUsed),
            nodeVersion: process.version,
          },
          server: {
            hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
            uptime: os.uptime(), processUptime: process.uptime(),
          },
          timestamp: new Date().toISOString(),
        });

    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch metrics', message: error.message });
    }
  });

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  // ====== Devices Management ======
  app.get('/api/admin/devices', adminAuth, (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let query = 'SELECT * FROM devices';
      let countQuery = 'SELECT COUNT(*) as total FROM devices';
      const params = [];
      const countParams = [];
      
      if (status === 'online') {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        query += ' WHERE last_seen > ?';
        countQuery += ' WHERE last_seen > ?';
        params.push(fiveMinAgo);
        countParams.push(fiveMinAgo);
      } else if (status === 'offline') {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        query += ' WHERE (last_seen <= ? OR last_seen IS NULL)';
        countQuery += ' WHERE (last_seen <= ? OR last_seen IS NULL)';
        params.push(fiveMinAgo);
        countParams.push(fiveMinAgo);
      }
      
      query += ' ORDER BY last_seen DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);
      
      const devices = db.prepare(query).all(...params);
      const { total } = countParams.length > 0
        ? db.prepare(countQuery).get(...countParams)
        : db.prepare(countQuery).get() || { total: 0 };
      
      res.json({ devices, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/devices/:id', adminAuth, (req, res) => {
    try {
      const { name, status } = req.body;
      const updates = [];
      const params = [];
      
      if (name) { updates.push('name = ?'); params.push(name); }
      if (status) { updates.push('status = ?'); params.push(status); }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      params.push(req.params.id);
      db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/devices/:id', adminAuth, (req, res) => {
    try {
      db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Sessions Management ======
  app.get('/api/admin/sessions', adminAuth, (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const sessions = db.prepare('SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?')
        .all(parseInt(limit), offset);
      const { total } = db.prepare('SELECT COUNT(*) as total FROM sessions').get();
      
      res.json({ sessions, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/sessions/:id', adminAuth, (req, res) => {
    try {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Webhook Management ======
  app.get('/api/admin/webhooks', adminAuth, (req, res) => {
    try {
      const logs = db.prepare('SELECT * FROM webhook_logs ORDER BY received_at DESC LIMIT 100').all();
      res.json({ logs, total: logs.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Memory Management ======
  app.get('/api/admin/memories', adminAuth, (req, res) => {
    try {
      const { page = 1, limit = 20, category } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let query = 'SELECT * FROM memories';
      let countQuery = 'SELECT COUNT(*) as total FROM memories';
      const params = [];
      
      if (category) {
        query += ' WHERE category = ?';
        countQuery += ' WHERE category = ?';
        params.push(category);
      }
      
      query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);
      
      const memories = db.prepare(query).all(...params);
      const { total } = db.prepare(countQuery).get(...(category ? [category] : []));
      
      res.json({ memories, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/memories/:id', adminAuth, (req, res) => {
    try {
      db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Server Health & Info ======
  app.get('/api/admin/info', adminAuth, (req, res) => {
    res.json({
      version: '3.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // ====== Audit Logs ======
  app.get('/api/admin/audit-logs', adminAuth, (req, res) => {
    try {
      const { page, pageSize, offset } = parsePagination(req.query);
      const { user, method, path: qPath } = req.query;
      let query = 'SELECT * FROM audit_logs';
      let countQuery = 'SELECT COUNT(*) as total FROM audit_logs';
      const conditions = [];
      const params = [];
      const countParams = [];
      if (user) { conditions.push('user = ?'); params.push(user); countParams.push(user); }
      if (method) { conditions.push('method = ?'); params.push(method.toUpperCase()); countParams.push(method.toUpperCase()); }
      if (qPath) { conditions.push("path LIKE ?"); params.push(`%${qPath}%`); countParams.push(`%${qPath}%`); }
      if (conditions.length > 0) {
        const clause = ' WHERE ' + conditions.join(' AND ');
        query += clause;
        countQuery += clause;
      }
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize, offset);
      const logs = db.prepare(query).all(...params);
      const { total } = db.prepare(countQuery).get(...countParams) || { total: 0 };
      res.json(buildPaginatedResponse(logs, page, pageSize, total));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Logs (real-time from DB + recent activities) ======
  app.get('/api/admin/logs', adminAuth, (req, res) => {
    try {
      const { type, limit = 50, offset = 0 } = req.query;
      
      // Collect logs from multiple sources
      const webhookLogs = db.prepare(
        'SELECT id, channel as source, received_at as timestamp, payload as message FROM webhook_logs ORDER BY received_at DESC LIMIT ?'
      ).all(parseInt(limit));
      
      const sessionLogs = db.prepare(
        "SELECT id, 'session' as source, updated_at as timestamp, title as message FROM sessions ORDER BY updated_at DESC LIMIT ?"
      ).all(parseInt(limit));

      const allLogs = [
        ...webhookLogs.map(l => ({ ...l, type: 'webhook' })),
        ...sessionLogs.map(l => ({ ...l, type: 'session' })),
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
       .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      res.json({ logs: allLogs, total: allLogs.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  // ====== Real-time Log Stream (SSE) ======
  app.get('/api/admin/logs/stream', (req, res) => {
    // Support both header and query param auth (EventSource doesn't support custom headers)
    const authHeader = req.headers['authorization'];
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) token = req.query.token;
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const payload = verifyAdminJWT(token);
    if (!payload || payload.role !== 'admin') {
      return res.status(401).json({ error: 'unauthorized' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write('data: ' + JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }) + '\n\n');

    const unsubscribe = subscribeLogs((data) => {
      try { res.write('data: ' + data + '\n\n'); } catch (e) {}
    });

    const heartbeat = setInterval(() => {
      try { res.write(':heartbeat\n\n'); } catch (e) { clearInterval(heartbeat); }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });


  // ====== Schedule Management (from CloudScheduler) ======
  // ====== Schedule Management (from CloudScheduler) ======
  app.get('/api/admin/schedules', adminAuth, (req, res) => {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM schedules';
      const params = [];
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC';
      const schedules = db.prepare(query).all(...params);
      res.json({ schedules, total: schedules.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/schedules', adminAuth, (req, res) => {
    try {
      const { name, cronExpr, actionType, actionConfig, maxRetries } = req.body;
      if (!name || !cronExpr) return res.status(400).json({ error: 'name and cronExpr required' });
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO schedules (id, name, cron_expr, action_type, action_config, max_retries, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, cronExpr, actionType || 'http', JSON.stringify(actionConfig || {}), maxRetries || 3, 'active', now, now);
      res.status(201).json({ id, name, cronExpr, status: 'active', created_at: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/schedules/:id', adminAuth, (req, res) => {
    try {
      const updates = [];
      const params = [];
      for (const [key, value] of Object.entries(req.body)) {
        if (['name', 'cron_expr', 'status', 'max_retries'].includes(key)) {
          if (key === 'status' && !['active', 'paused', 'disabled'].includes(value)) {
            return res.status(400).json({ error: 'invalid_status', validValues: ['active', 'paused', 'disabled'] });
          }
          if (key === 'max_retries' && (typeof value !== 'number' || value < 0 || value > 100)) {
            return res.status(400).json({ error: 'invalid_max_retries', detail: 'must be number 0-100' });
          }
          updates.push(`${key} = ?`);
          params.push(value);
        }
      }
      if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(req.params.id);
      db.prepare(`UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/schedules/:id', adminAuth, (req, res) => {
    try {
      db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== API Keys Management ======
  app.get('/api/admin/api-keys', adminAuth, (req, res) => {
    try {
      const keys = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all();
      res.json({ keys, total: keys.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/api-keys', adminAuth, (req, res) => {
    try {
      const { name, permissions, expiresAt } = req.body;
      const id = randomUUID();
      const key = `lj_${randomUUID().replace(/-/g, '')}`;
      const now = new Date().toISOString();
      db.prepare('INSERT INTO api_keys (id, user_id, name, key, permissions, created_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, 'admin', name || 'API Key', key, JSON.stringify(permissions || []), now, expiresAt || null, 'active');
      res.status(201).json({ id, name, key, maskedKey: `${key.slice(0, 8)}...${key.slice(-4)}`, permissions: permissions || [], created_at: now, status: 'active' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/api-keys/:id', adminAuth, (req, res) => {
    try {
      db.prepare('DELETE FROM api_keys WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Conversations Management ======
  app.get('/api/admin/conversations', adminAuth, (req, res) => {
    try {
      const conversations = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50').all();
      const parsed = conversations.map(c => ({
        ...c,
        messages: safeJsonParse(c.messages, []).length
      }));
      res.json({ conversations: parsed, total: parsed.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Defect Management ======
  app.get('/api/admin/defects', adminAuth, (req, res) => {
    try {
      const { page, pageSize, offset } = parsePagination(req.query);
      const { severity, status } = req.query;
      let query = 'SELECT * FROM defects';
      let countQuery = 'SELECT COUNT(*) as total FROM defects';
      const conditions = [];
      const params = [];
      const countParams = [];
      if (severity) { conditions.push('severity = ?'); params.push(severity); countParams.push(severity); }
      if (status) { conditions.push('status = ?'); params.push(status); countParams.push(status); }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize, offset);
      const defects = db.prepare(query).all(...params);
      const { total } = db.prepare(countQuery).get(...countParams) || { total: 0 };
      res.json(buildPaginatedResponse(defects, page, pageSize, total));
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.post('/api/admin/defects', adminAuth, (req, res) => {
    try {
      const vErr = validateInput({
        title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
        severity: { required: true, type: 'enum', enumValues: ['P0','P1','P2','P3'] },
      }, req.body);
      if (vErr) return res.status(400).json(buildErrorResponse('validation_error', null, vErr));
      const { title, severity, module, description, reporter_id, assignee_id } = req.body;
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO defects (id, title, severity, module, description, status, reporter_id, assignee_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, title, severity, module || null, description || null, 'open', reporter_id || null, assignee_id || null, now, now);
      res.status(201).json({ id, title, severity, status: 'open', created_at: now });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.put('/api/admin/defects/:id/fix', adminAuth, (req, res) => {
    try {
      const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(req.params.id);
      if (!defect) return res.status(404).json(buildErrorResponse('not_found', 'Defect not found'));
      if (!['open','fixing'].includes(defect.status)) return res.status(400).json(buildErrorResponse('invalid_status', `Cannot fix from status: ${defect.status}`));
      const { fix_description } = req.body;
      const now = new Date().toISOString();
      const newStatus = defect.status === 'open' ? 'fixing' : 'fixed';
      db.prepare('UPDATE defects SET status = ?, fix_description = ?, updated_at = ? WHERE id = ?')
        .run(newStatus, fix_description || null, now, req.params.id);
      res.json({ ok: true, status: newStatus });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.put('/api/admin/defects/:id/verify', adminAuth, (req, res) => {
    try {
      const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(req.params.id);
      if (!defect) return res.status(404).json(buildErrorResponse('not_found', 'Defect not found'));
      if (defect.status !== 'fixed') return res.status(400).json(buildErrorResponse('invalid_status', 'Only fixed defects can be verified'));
      const { verified } = req.body;
      const now = new Date().toISOString();
      const newStatus = verified === false ? 'open' : 'verified';
      db.prepare('UPDATE defects SET status = ?, updated_at = ?, closed_at = ? WHERE id = ?')
        .run(newStatus, now, newStatus === 'verified' ? now : null, req.params.id);
      res.json({ ok: true, status: newStatus });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  // ====== Push Notification Management ======
  app.get('/api/admin/push', adminAuth, (req, res) => {
    try {
      const { page, pageSize, offset } = parsePagination(req.query);
      const notifications = db.prepare('SELECT * FROM push_notifications ORDER BY created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset);
      const { total } = db.prepare('SELECT COUNT(*) as total FROM push_notifications').get() || { total: 0 };
      res.json(buildPaginatedResponse(notifications, page, pageSize, total));
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.post('/api/admin/push/send', adminAuth, (req, res) => {
    try {
      const vErr = validateInput({
        title: { required: true, type: 'string', minLength: 1 },
        body: { required: true, type: 'string', minLength: 1 },
      }, req.body);
      if (vErr) return res.status(400).json(buildErrorResponse('validation_error', null, vErr));
      const { title, body: msgBody, device_id, user_id, channel } = req.body;
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO push_notifications (id, type, title, body, device_id, user_id, delivery_status, channel, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, 'custom', title, msgBody, device_id || null, user_id || null, 'pending', channel || 'websocket', now);
      res.status(201).json({ id, status: 'pending', created_at: now });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.get('/api/admin/push/stats', adminAuth, (req, res) => {
    try {
      const total = db.prepare('SELECT COUNT(*) as c FROM push_notifications').get()?.c || 0;
      const sent = db.prepare("SELECT COUNT(*) as c FROM push_notifications WHERE delivery_status = 'sent'").get()?.c || 0;
      const failed = db.prepare("SELECT COUNT(*) as c FROM push_notifications WHERE delivery_status = 'failed'").get()?.c || 0;
      const pending = db.prepare("SELECT COUNT(*) as c FROM push_notifications WHERE delivery_status = 'pending'").get()?.c || 0;
      res.json({ total, sent, failed, pending });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  // ====== System Config Management ======
  app.get('/api/admin/config', adminAuth, (req, res) => {
    try {
      const configs = db.prepare('SELECT * FROM system_config ORDER BY key').all();
      res.json({ data: configs });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.put('/api/admin/config', adminAuth, (req, res) => {
    try {
      const { key, value, description } = req.body;
      const vErr = validateInput({
        key: { required: true, type: 'string', minLength: 1 },
        value: { required: true },
      }, req.body);
      if (vErr) return res.status(400).json(buildErrorResponse('validation_error', null, vErr));
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
      const oldValue = existing ? existing.value : null;
      db.prepare('INSERT OR REPLACE INTO system_config (key, value, description, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(key, JSON.stringify(value), description || null, req.admin?.sub || 'admin', now);
      db.prepare('INSERT INTO config_audit_log (id, config_key, old_value, new_value, operator, operated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), key, oldValue, JSON.stringify(value), req.admin?.sub || 'admin', now);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  // ====== Skill Management ======
  app.get('/api/admin/skills', adminAuth, (req, res) => {
    try {
      const { page, pageSize, offset } = parsePagination(req.query);
      const { category } = req.query;
      let query = 'SELECT * FROM skills';
      let countQuery = 'SELECT COUNT(*) as total FROM skills';
      const params = [];
      const countParams = [];
      if (category) { query += ' WHERE category = ?'; countQuery += ' WHERE category = ?'; params.push(category); countParams.push(category); }
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize, offset);
      const skills = db.prepare(query).all(...params);
      const { total } = db.prepare(countQuery).get(...countParams) || { total: 0 };
      res.json(buildPaginatedResponse(skills, page, pageSize, total));
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.put('/api/admin/skills/:id/approve', adminAuth, (req, res) => {
    try {
      const now = new Date().toISOString();
      const result = db.prepare('UPDATE skills SET status = ?, updated_at = ? WHERE id = ?').run('approved', now, req.params.id);
      if (result.changes === 0) return res.status(404).json(buildErrorResponse('not_found', 'Skill not found'));
      res.json({ ok: true, status: 'approved' });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.put('/api/admin/skills/:id/reject', adminAuth, (req, res) => {
    try {
      const { reason } = req.body;
      const now = new Date().toISOString();
      const result = db.prepare('UPDATE skills SET status = ?, description = ?, updated_at = ? WHERE id = ?').run('rejected', reason ? `Rejected: ${reason}` : null, now, req.params.id);
      if (result.changes === 0) return res.status(404).json(buildErrorResponse('not_found', 'Skill not found'));
      res.json({ ok: true, status: 'rejected' });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  // ====== Session Detail & Update ======
  app.get('/api/admin/sessions/:id', adminAuth, (req, res) => {
    try {
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
      if (!session) return res.status(404).json(buildErrorResponse('not_found', 'Session not found'));
      res.json(session);
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.put('/api/admin/sessions/:id', adminAuth, (req, res) => {
    try {
      const { status, title } = req.body;
      const updates = [];
      const params = [];
      if (title) { updates.push('title = ?'); params.push(title); }
      if (status) { updates.push('metadata = ?'); params.push(JSON.stringify({ status })); }
      if (updates.length === 0) return res.status(400).json(buildErrorResponse('validation_error', 'No fields to update'));
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(req.params.id);
      db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  // ====== Device Create ======
  app.post('/api/admin/devices', adminAuth, (req, res) => {
    try {
      const vErr = validateInput({
        name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        device_info: { required: true },
      }, req.body);
      if (vErr) return res.status(400).json(buildErrorResponse('validation_error', null, vErr));
      const { name, device_info } = req.body;
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO devices (id, name, device_info, created_at) VALUES (?, ?, ?, ?)')
        .run(id, name, JSON.stringify(device_info), now);
      res.status(201).json({ id, name, created_at: now });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  // ====== Memory CRUD Enhancement ======
  app.post('/api/admin/memories', adminAuth, (req, res) => {
    try {
      const vErr = validateInput({
        title: { required: true, type: 'string', minLength: 1 },
        content: { required: true, type: 'string', minLength: 1 },
        category: { required: true, type: 'string', minLength: 1 },
      }, req.body);
      if (vErr) return res.status(400).json(buildErrorResponse('validation_error', null, vErr));
      const { title, content, category, scope } = req.body;
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO memories (id, title, content, category, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, title, content, category, scope || 'project', now, now);
      res.status(201).json({ id, title, category, created_at: now });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  app.put('/api/admin/memories/:id', adminAuth, (req, res) => {
    try {
      const { title, content, category } = req.body;
      const updates = [];
      const params = [];
      if (title) { updates.push('title = ?'); params.push(title); }
      if (content) { updates.push('content = ?'); params.push(content); }
      if (category) { updates.push('category = ?'); params.push(category); }
      if (updates.length === 0) return res.status(400).json(buildErrorResponse('validation_error', 'No fields to update'));
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(req.params.id);
      db.prepare(`UPDATE memories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json(buildErrorResponse('internal_error', error.message));
    }
  });

  // ====== Legacy API endpoints (for backward compatibility) ======
  // These endpoints bridge the gap between the old /api/* pattern and the new /api/admin/* pattern

  // GET /api/health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Apply rate limiting + audit to legacy /api/ routes (after health check)
  app.use('/api/', apiRateLimit, auditLog);

  // ====== Users (from `users` table) ======
  app.get('/api/users', adminAuth, (req, res) => {
    try {
      const { page, pageSize, offset } = parsePagination(req.query);
      const users = db.prepare(`
        SELECT id, username as name, email, 'user' as role, 'active' as status, registered_at as createdAt, last_login_at
        FROM users ORDER BY registered_at DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset);
      const total = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
      res.json(buildPaginatedResponse(users, page, pageSize, total));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users', adminAuth, (req, res) => {
    try {
      const { name, username: reqUsername, email } = req.body;
      const username = name || reqUsername;
      if (!username || !email) {
        return res.status(400).json({ error: 'username and email are required' });
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      const passwordHash = hashPassword(req.body.password || randomUUID());
      const salt = passwordHash.split(':')[0];
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, password_salt, registered_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, username, email, passwordHash, salt, now);
      res.json({ id, username, email, createdAt: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/users/:id', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, password_strength } = req.body;
      const updates = [];
      const params = [];
      if (name) { updates.push("username = ?"); params.push(name); }
      if (email) { updates.push("email = ?"); params.push(email); }
      if (password_strength) { updates.push("password_strength = ?"); params.push(password_strength); }
      if (updates.length === 0) return res.status(400).json({ error: 'no fields to update' });
      params.push(id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/users/:id', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Devices (merged from user_devices + devices tables) ======
  app.get('/api/devices', adminAuth, (req, res) => {
    try {
      // Get user-bound devices
      const userDevices = db.prepare(`
        SELECT d.*, u.username as userName
        FROM user_devices d
        LEFT JOIN users u ON d.user_id = u.id
        ORDER BY d.last_sync_at DESC
      `).all();
      
      // Get auth-registered IDE devices (devices table)
      const registeredDevices = db.prepare(`
        SELECT id, name, device_info, last_seen, created_at
        FROM devices
        ORDER BY last_seen DESC
      `).all();
      
      // Merge: user_devices first, then add registered devices not already in user_devices
      const userDeviceIds = new Set(userDevices.map(d => d.id));
      const allDevices = [
        ...userDevices.map(d => ({
          id: d.id,
          userId: d.user_id,
          userName: d.userName || 'Unknown',
          name: d.name || 'Unnamed Device',
          platform: d.os || d.type || 'unknown',
          lastActive: d.last_sync_at,
          status: d.is_online ? 'online' : 'offline',
          type: d.type,
          os: d.os,
          syncStatus: d.sync_status,
          authorizationStatus: d.authorization_status,
          boundAt: d.bound_at,
          source: 'user_bound',
        })),
        ...registeredDevices
          .filter(d => !userDeviceIds.has(d.id))
          .map(d => {
            let info = {};
            try { info = JSON.parse(d.device_info || '{}'); } catch {}
            return {
              id: d.id,
              userId: d.user_id || info.userId || '',
              userName: '',
              name: d.name || info.name || 'Unknown IDE',
              platform: info.os || info.platform || 'unknown',
              lastActive: d.last_seen,
              status: d.last_seen && (Date.now() - new Date(d.last_seen).getTime() < 300000) ? 'online' : 'offline',
              os: info.os,
              version: info.version,
              source: 'auth_registered',
              createdAt: d.created_at,
            };
          }),
      ];
      
      res.json(allDevices);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/devices/:id/status', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const isOnline = status === 'online' ? 1 : 0;
      db.prepare('UPDATE user_devices SET is_online = ?, sync_status = ? WHERE id = ?').run(isOnline, status, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Version Review System (DB-driven, v1.71+) ======

  // Helper: sync approved versions from DB to versions.json for electron-updater
  // MERGES with existing JSON data — never removes historical versions that exist only in JSON
  function syncApprovedVersionsToJson() {
    try {
      const approved = db.prepare("SELECT * FROM versions WHERE status = 'approved' ORDER BY version DESC").all();
      // Read existing versions.json to preserve historical entries not yet in DB
      const existing = readVersionsJson();
      const existingVersions = existing.versions || [];
      // Build a map of version→index for dedup
      const existingMap = new Map();
      existingVersions.forEach((v, i) => { existingMap.set(v.version, i); });

      for (const v of approved) {
        let filesObj = {};
        try { filesObj = JSON.parse(v.files || '{}'); } catch {}
        const entry = {
          version: v.version,
          releaseDate: v.reviewed_at || v.created_at,
          releaseNotes: v.changelog || '',
          downloadUrl: v.download_url || '',
          files: filesObj,
          status: 'published'
        };
        const idx = existingMap.get(v.version);
        if (idx !== undefined) {
          // Update existing entry while preserving any extra fields (platforms, etc.)
          existingVersions[idx] = { ...existingVersions[idx], ...entry, status: 'published' };
        } else {
          // New version from DB — add to front
          existingVersions.unshift(entry);
        }
      }

      const latestApproved = approved.length > 0 ? approved[0].version : (existing.latest || '0.0.0');
      const data = { latest: latestApproved, versions: existingVersions };
      writeVersionsJson(data);
      console.log('[Admin API] Merged', approved.length, 'approved DB versions into versions.json (total:', existingVersions.length, 'entries)');
    } catch (e) {
      console.error('[Admin API] Failed to sync versions.json:', e.message);
    }
  }

  // Helper: promote draft latest.yml to live latest.yml on approve
  function promoteYamlFiles(version) {
    const downloadDirs = [
      '/var/www/downloads/',
      '/var/www/html/downloads/',
      '/var/www/lingjing/',
    ];
    for (const downloadDir of downloadDirs) {
      try {
        const draftYml = path.join(downloadDir, 'latest-draft-' + version + '.yml');
        const liveYml = path.join(downloadDir, 'latest.yml');
        if (fs.existsSync(draftYml)) {
          if (fs.existsSync(liveYml)) fs.copyFileSync(liveYml, liveYml + '.bak');
          fs.copyFileSync(draftYml, liveYml);
          fs.unlinkSync(draftYml);
          console.log('[Admin API] latest.yml promoted to:', version, 'in', downloadDir);
        }
        const draftLinuxYml = path.join(downloadDir, 'latest-linux-draft-' + version + '.yml');
        const liveLinuxYml = path.join(downloadDir, 'latest-linux.yml');
        if (fs.existsSync(draftLinuxYml)) {
          if (fs.existsSync(liveLinuxYml)) fs.copyFileSync(liveLinuxYml, liveLinuxYml + '.bak');
          fs.copyFileSync(draftLinuxYml, liveLinuxYml);
          fs.unlinkSync(draftLinuxYml);
          console.log('[Admin API] latest-linux.yml promoted to:', version, 'in', downloadDir);
        }
      } catch (e) {
        console.warn('[Admin API] Failed to promote yml in', downloadDir, ':', e.message);
      }
    }
  }

  // GET /api/versions — list versions from DB (with optional status filter + pagination)
  app.get('/api/versions', adminAuth, (req, res) => {
    try {
      const { status, page: pg, pageSize: ps } = req.query;
      const { page, pageSize, offset } = parsePagination({ page: pg, pageSize: ps });
      let sql = 'SELECT * FROM versions';
      let countSql = 'SELECT COUNT(*) as total FROM versions';
      const params = [];
      if (status && ['draft','pending_review','approved','rejected'].includes(status)) {
        sql += ' WHERE status = ?';
        countSql += ' WHERE status = ?';
        params.push(status);
      }
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const total = db.prepare(countSql).get(...params)?.total || 0;
      const rows = db.prepare(sql).all(...params, pageSize, offset);
      // Map to compatible format
      const result = rows.map(v => {
        let filesObj = {};
        try { filesObj = JSON.parse(v.files || '{}'); } catch {}
        return {
          id: v.id,
          version: v.version,
          releaseDate: v.reviewed_at || v.created_at,
          changelog: v.changelog || '',
          downloadUrl: v.download_url || '',
          files: filesObj,
          status: v.status,
          active: v.status === 'approved',
          locked: !!v.locked,
          submitter: v.submitter_name || v.submitter_id || '',
          reviewer: v.reviewer_name || v.reviewer_id || '',
          submittedAt: v.submitted_at || null,
          reviewedAt: v.reviewed_at || null,
          rejectReason: v.reject_reason || '',
          created_at: v.created_at,
        };
      });
      res.json(buildPaginatedResponse(result, page, pageSize, total));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/versions/:version — single version with review history
  app.get('/api/versions/:version', adminAuth, (req, res) => {
    try {
      const v = db.prepare('SELECT * FROM versions WHERE version = ?').get(req.params.version);
      if (!v) return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
      const reviews = db.prepare('SELECT * FROM version_reviews WHERE version_id = ? ORDER BY created_at DESC').all(v.id);
      let filesObj = {};
      try { filesObj = JSON.parse(v.files || '{}'); } catch {}
      res.json({
        id: v.id, version: v.version, status: v.status, changelog: v.changelog,
        downloadUrl: v.download_url, files: filesObj, locked: !!v.locked,
        submitter: v.submitter_name || v.submitter_id || '',
        reviewer: v.reviewer_name || v.reviewer_id || '',
        submittedAt: v.submitted_at, reviewedAt: v.reviewed_at,
        rejectReason: v.reject_reason, created_at: v.created_at, updated_at: v.updated_at,
        reviews
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/versions — create version (draft) in DB
  app.post('/api/versions', adminAuth, (req, res) => {
    try {
      const { version, changelog, downloadUrl, files } = req.body;
      if (!version) return res.status(400).json({ error: 'version required' });
      const now = new Date().toISOString();
      const id = randomUUID();

      // Check existence
      const existing = db.prepare('SELECT id, status, locked FROM versions WHERE version = ?').get(version);
      if (existing) {
        if (existing.locked) {
          return res.status(403).json({ error: 'version_locked', message: '该版本已锁定，不可修改' });
        }
        // Update existing draft/rejected
        db.prepare(`UPDATE versions SET changelog=?, download_url=?, files=?, updated_at=?, status='draft', locked=0, reviewed_at=NULL, reviewer_id='', reviewer_name='', reject_reason='' WHERE version=?`)
          .run(changelog || '', downloadUrl || '', JSON.stringify(files || {}), now, version);
        console.log('[Admin API] Version updated (draft):', version);
        return res.json({ id: existing.id, version, status: 'draft', updated_at: now });
      }

      const submitterName = req.admin?.sub || req.admin?.username || '';
      db.prepare(`INSERT INTO versions (id, version, status, changelog, download_url, files, submitter_id, submitter_name, created_at, updated_at)
        VALUES (?,?, 'draft',?,?,?,?,?,?,?)`)
        .run(id, version, changelog || '', downloadUrl || '', JSON.stringify(files || {}), req.admin?.sub || '', submitterName, now, now);
      console.log('[Admin API] Version created (draft):', version);
      res.status(201).json({ id, version, status: 'draft', created_at: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  // PUT /api/versions/:id — update version (only if not locked)
  app.put('/api/versions/:id', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { version, changelog, downloadUrl, files } = req.body;
      const v = db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
      if (!v) return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
      if (v.locked) return res.status(403).json({ error: 'version_locked', message: '该版本已锁定，不可修改' });
      const now = new Date().toISOString();
      db.prepare('UPDATE versions SET version=?, changelog=?, download_url=?, files=?, updated_at=? WHERE id=?')
        .run(version || v.version, changelog ?? v.changelog, downloadUrl ?? v.download_url, files ? JSON.stringify(files) : v.files, now, id);
      res.json({ ok: true, id, updated_at: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/versions/:version/submit — submit for review (draft/rejected → pending_review)
  app.post('/api/versions/:version/submit', adminAuth, (req, res) => {
    try {
      const { version } = req.params;
      const now = new Date().toISOString();
      const v = db.prepare('SELECT * FROM versions WHERE version = ?').get(version);
      if (!v) return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
      if (v.status === 'approved') return res.json({ ok: true, version, status: 'approved', message: '版本已审核通过，无需重复提交' });
      if (v.status === 'pending_review') return res.json({ ok: true, version, status: 'pending_review', message: '版本已在审核中' });
      if (v.locked) return res.status(403).json({ error: 'version_locked', message: '该版本已锁定，不可操作' });

      const submitterName = req.admin?.sub || req.admin?.username || '';
      db.prepare("UPDATE versions SET status='pending_review', submitted_at=?, submitter_id=?, submitter_name=?, updated_at=? WHERE id=?")
        .run(now, req.admin?.sub || '', submitterName, now, v.id);
      // Audit log
      db.prepare('INSERT INTO version_reviews (id, version_id, action, reviewer_id, reviewer_name, old_status, new_status, created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(randomUUID(), v.id, 'submit', req.admin?.sub || '', submitterName, v.status, 'pending_review', now);
      console.log('[Admin API] Version submitted for review:', version);
      res.json({ ok: true, version, status: 'pending_review', message: '版本已提交审核' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Backward compat: /api/versions/:version/submit-review → same as submit
  app.post('/api/versions/:version/submit-review', adminAuth, (req, res) => {
    // Delegate to submit logic directly
    const { version } = req.params;
    const now = new Date().toISOString();
    const v = db.prepare('SELECT * FROM versions WHERE version = ?').get(version);
    if (!v) return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
    if (v.status === 'approved') return res.json({ ok: true, version, status: 'approved', message: '版本已审核通过，无需重复提交' });
    if (v.status === 'pending_review') return res.json({ ok: true, version, status: 'pending_review', message: '版本已在审核中' });
    if (v.locked) return res.status(403).json({ error: 'version_locked', message: '该版本已锁定，不可操作' });

    const submitterName = req.admin?.sub || req.admin?.username || '';
    db.prepare("UPDATE versions SET status='pending_review', submitted_at=?, submitter_id=?, submitter_name=?, updated_at=? WHERE id=?")
      .run(now, req.admin?.sub || '', submitterName, now, v.id);
    db.prepare('INSERT INTO version_reviews (id, version_id, action, reviewer_id, reviewer_name, old_status, new_status, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(randomUUID(), v.id, 'submit', req.admin?.sub || '', submitterName, v.status, 'pending_review', now);
    console.log('[Admin API] Version submitted for review (submit-review):', version);
    res.json({ ok: true, version, status: 'pending_review', message: '版本已提交审核' });
  });

  // ====== Approve version (reviewerAuth: pending_review → approved) ======
  app.post('/api/versions/:version/approve', reviewerAuth, (req, res) => {
    try {
      const { version } = req.params;
      const { comment } = req.body;
      const now = new Date().toISOString();
      const v = db.prepare('SELECT * FROM versions WHERE version = ?').get(version);
      if (!v) return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
      if (v.status === 'approved') return res.json({ ok: true, version, status: 'approved', message: '版本已审核通过' });
      if (v.status !== 'pending_review') {
        return res.status(400).json({ error: 'invalid_status', message: '仅待审核状态的版本可以审核通过' });
      }

      const reviewerName = req.admin?.sub || req.admin?.username || '';
      // Atomic update: approve + lock
      db.prepare("UPDATE versions SET status='approved', locked=1, reviewer_id=?, reviewer_name=?, reviewed_at=?, updated_at=? WHERE id=?")
        .run(req.admin?.sub || '', reviewerName, now, now, v.id);
      // Audit log
      db.prepare('INSERT INTO version_reviews (id, version_id, action, reviewer_id, reviewer_name, comment, old_status, new_status, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(randomUUID(), v.id, 'approve', req.admin?.sub || '', reviewerName, comment || '', 'pending_review', 'approved', now);

      // Sync to versions.json for electron-updater compatibility
      syncApprovedVersionsToJson();

      // Promote draft latest.yml to live latest.yml
      promoteYamlFiles(version);

      console.log('[Admin API] Version approved:', version, 'by', reviewerName);
      res.json({ ok: true, version, status: 'approved', reviewer: reviewerName, reviewed_at: now, message: '版本审核通过，已锁定并同步到更新服务器' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Reject version (reviewerAuth: pending_review → rejected) ======
  app.post('/api/versions/:version/reject', reviewerAuth, (req, res) => {
    try {
      const { version } = req.params;
      const { reason } = req.body;
      if (!reason || !reason.trim()) return res.status(400).json({ error: 'reason_required', message: '驳回原因不能为空' });
      const now = new Date().toISOString();
      const v = db.prepare('SELECT * FROM versions WHERE version = ?').get(version);
      if (!v) return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
      if (v.status !== 'pending_review') {
        return res.status(400).json({ error: 'invalid_status', message: '仅待审核状态的版本可以驳回' });
      }

      const reviewerName = req.admin?.sub || req.admin?.username || '';
      db.prepare("UPDATE versions SET status='rejected', reject_reason=?, reviewer_id=?, reviewer_name=?, reviewed_at=?, updated_at=? WHERE id=?")
        .run(reason.trim(), req.admin?.sub || '', reviewerName, now, now, v.id);
      // Audit log
      db.prepare('INSERT INTO version_reviews (id, version_id, action, reviewer_id, reviewer_name, comment, old_status, new_status, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(randomUUID(), v.id, 'reject', req.admin?.sub || '', reviewerName, reason.trim(), 'pending_review', 'rejected', now);

      console.log('[Admin API] Version rejected:', version, 'by', reviewerName, 'reason:', reason);
      res.json({ ok: true, version, status: 'rejected', reason: reason.trim(), reviewer: reviewerName, reviewed_at: now, message: '版本已驳回' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Publish (deprecated — delegates to approve for backward compat) ======
  app.post('/api/versions/:version/publish', adminAuth, (req, res) => {
    try {
      const { version } = req.params;
      const v = db.prepare('SELECT * FROM versions WHERE version = ?').get(version);
      if (!v) return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
      if (v.status === 'approved') return res.json({ ok: true, version, status: 'approved', message: '版本已发布' });
      // Auto-approve for backward compat: bypass pending_review requirement
      const now = new Date().toISOString();
      const reviewerName = req.admin?.sub || req.admin?.username || '';
      db.prepare("UPDATE versions SET status='approved', locked=1, reviewer_id=?, reviewer_name=?, reviewed_at=?, updated_at=? WHERE id=?")
        .run(req.admin?.sub || '', reviewerName, now, now, v.id);
      db.prepare('INSERT INTO version_reviews (id, version_id, action, reviewer_id, reviewer_name, comment, old_status, new_status, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(randomUUID(), v.id, 'approve', req.admin?.sub || '', reviewerName, '直接发布(兼容旧接口)', v.status, 'approved', now);
      syncApprovedVersionsToJson();
      promoteYamlFiles(version);
      console.log('[Admin API] Version published (deprecated endpoint):', version);
      res.json({ ok: true, version, status: 'approved', message: '版本已成功发布（建议使用 /approve 接口）' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  // ====== Sync Status ======
  app.get('/api/sync', adminAuth, (req, res) => {
    try {
      const totalRecords = db.prepare('SELECT COUNT(*) as count FROM sync_records').get()?.count || 0;
      const lastSync = db.prepare('SELECT MAX(timestamp) as last FROM sync_records').get()?.last || null;
      const successCount = db.prepare("SELECT COUNT(*) as count FROM sync_records WHERE status = 'success'").get()?.count || 0;
      const storageTotal = db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM sync_records').get()?.total || 0;
      const successRate = totalRecords > 0 ? Math.round((successCount / totalRecords) * 100) : 100;

      res.json({
        status: 'synced',
        lastSync: lastSync || new Date().toISOString(),
        totalRecords,
        successRate,
        storageUsed: formatStorage(storageTotal),
        pendingConflicts: db.prepare('SELECT COUNT(*) as count FROM sync_conflicts').get()?.count || 0
      });
    } catch (error) {
      res.json({
        status: 'unknown',
        lastSync: null,
        totalRecords: 0,
        successRate: 100,
        storageUsed: '0 B',
        pendingConflicts: 0
      });
    }
  });

  app.get('/api/sync/data', adminAuth, (req, res) => {
    try {
      const records = db.prepare(`
        SELECT * FROM sync_records ORDER BY timestamp DESC LIMIT 100
      `).all();
      res.json(records);
    } catch (error) {
      res.json([]);
    }
  });

  // ====== Subscriptions ======
  app.get('/api/subscriptions', adminAuth, (req, res) => {
    try {
      const { page, pageSize, offset } = parsePagination(req.query);
      const subscriptions = db.prepare(`
        SELECT s.*, u.username as userName, u.email as userEmail
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.started_at DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset);
      const total = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get()?.count || 0;
      const mapped = subscriptions.map(s => ({
        id: s.id,
        userId: s.user_id,
        userName: s.userName || s.userEmail || s.user_id?.substring(0, 8) || 'Unknown',
        plan: s.plan_name || s.plan_id,
        status: s.status,
        startDate: s.started_at,
        endDate: s.expires_at,
        autoRenew: !!s.auto_renew,
        price: 0
      }));
      res.json(buildPaginatedResponse(mapped, page, pageSize, total));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/subscriptions/:id', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { plan, status, endDate, autoRenew } = req.body;
      const updates = [];
      const params = [];
      if (plan) { updates.push('plan_name = ?'); params.push(plan); }
      if (status) { updates.push('status = ?'); params.push(status); }
      if (endDate) { updates.push('expires_at = ?'); params.push(endDate); }
      if (autoRenew !== undefined) { updates.push('auto_renew = ?'); params.push(autoRenew ? 1 : 0); }
      if (updates.length === 0) return res.status(400).json({ error: 'no fields to update' });
      params.push(id);
      db.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  // ====== Subscription Plans Management ======
  app.get('/api/admin/plans', adminAuth, (req, res) => {
    try {
      const plans = db.prepare('SELECT * FROM plans ORDER BY price ASC').all();
      res.json(plans.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        billingCycle: p.billing_cycle,
        features: JSON.parse(p.features || '[]'),
        limits: JSON.parse(p.limits || '{}'),
        recommended: !!p.recommended,
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/plans', adminAuth, (req, res) => {
    try {
      const { id, name, price, billingCycle, features, limits, recommended } = req.body;
      if (!id || !name || price === undefined) {
        return res.status(400).json({ error: 'id, name, and price required' });
      }
      const existing = db.prepare('SELECT id FROM plans WHERE id = ?').get(id);
      if (existing) {
        return res.status(409).json({ error: 'plan_id_already_exists' });
      }
      db.prepare('INSERT INTO plans (id, name, price, billing_cycle, features, limits, recommended) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, price, billingCycle || 'monthly', JSON.stringify(features || []), JSON.stringify(limits || {}), recommended ? 1 : 0);
      res.status(201).json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/plans/:id', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { name, price, billingCycle, features, limits, recommended } = req.body;
      const updates = [];
      const params = [];
      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (price !== undefined) { updates.push('price = ?'); params.push(price); }
      if (billingCycle !== undefined) { updates.push('billing_cycle = ?'); params.push(billingCycle); }
      if (features !== undefined) { updates.push('features = ?'); params.push(JSON.stringify(features)); }
      if (limits !== undefined) { updates.push('limits = ?'); params.push(JSON.stringify(limits)); }
      if (recommended !== undefined) { updates.push('recommended = ?'); params.push(recommended ? 1 : 0); }
      if (updates.length === 0) return res.status(400).json({ error: 'no_fields_to_update' });
      params.push(id);
      db.prepare('UPDATE plans SET ' + updates.join(', ') + ' WHERE id = ?').run(...params);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/plans/:id', adminAuth, (req, res) => {
    try {
      db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Payments Management ======
  app.get('/api/admin/payments', adminAuth, (req, res) => {
    try {
      const { status, method } = req.query;
      const { page, pageSize, offset } = parsePagination(req.query);
      let sql = 'SELECT p.*, u.username as user_name FROM payments p LEFT JOIN users u ON p.user_id = u.id';
      let countSql = 'SELECT COUNT(*) as count FROM payments p';
      const where = [];
      const params = [];
      if (status) { where.push('p.payment_status = ?'); params.push(status); }
      if (method) { where.push('p.payment_method = ?'); params.push(method); }
      if (where.length > 0) {
        const whereClause = ' WHERE ' + where.join(' AND ');
        sql += whereClause;
        countSql += whereClause;
      }
      sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      const payments = db.prepare(sql).all(...params, pageSize, offset);
      const total = db.prepare(countSql).get(...params)?.count || 0;
      res.json(buildPaginatedResponse(payments.map(p => ({
        id: p.id,
        userId: p.user_id,
        userName: p.user_name || 'Unknown',
        subscriptionId: p.subscription_id,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.payment_method,
        status: p.payment_status,
        transactionId: p.transaction_id,
        invoiceNumber: p.invoice_number,
        paidAt: p.paid_at,
        createdAt: p.created_at,
      })), page, pageSize, total));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/payments/:id/verify', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { status, transactionId } = req.body;
      if (!status || !['success', 'failed', 'refunded'].includes(status)) {
        return res.status(400).json({ error: 'valid_status_required' });
      }
      const now = new Date().toISOString();
      const updates = ["payment_status = ?", "paid_at = ?"];
      const params = [status, now];
      if (transactionId) { updates.push("transaction_id = ?"); params.push(transactionId); }
      params.push(id);
      db.prepare('UPDATE payments SET ' + updates.join(', ') + ' WHERE id = ?').run(...params);

      // If payment confirmed, also activate subscription if pending
      if (status === 'success') {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
        if (payment && payment.subscription_id) {
          db.prepare('UPDATE subscriptions SET status = ? WHERE id = ? AND status = ?')
            .run('active', payment.subscription_id, 'pending');
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Offline Payments Management ======
  app.get('/api/admin/offline-payments', adminAuth, (req, res) => {
    try {
      const { status } = req.query;
      let sql = 'SELECT o.*, u.username as user_name FROM offline_payments o LEFT JOIN users u ON o.user_id = u.id';
      const params = [];
      if (status) {
        sql += ' WHERE o.status = ?';
        params.push(status);
      }
      const rows = db.prepare(sql + ' ORDER BY o.created_at DESC').all(...params);
      res.json(rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name || 'Unknown',
        amount: r.amount,
        companyName: r.company_name,
        bankName: r.bank_name,
        bankAccount: r.bank_account,
        remark: r.remark,
        receiptUrl: r.receipt_url,
        status: r.status,
        verifiedBy: r.verified_by,
        verifiedAt: r.verified_at,
        createdAt: r.created_at,
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/offline-payments/:id/verify', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminUserId } = req.body;
      if (!status || !['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'valid_status_required' });
      }
      const now = new Date().toISOString();
      db.prepare('UPDATE offline_payments SET status = ?, verified_by = ?, verified_at = ? WHERE id = ?')
        .run(status, adminUserId || 'admin', now, id);

      // If verified, create subscription for the user
      if (status === 'verified') {
        const payment = db.prepare('SELECT * FROM offline_payments WHERE id = ?').get(id);
        if (payment) {
          const subId = randomUUID();
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1);
          db.prepare('INSERT INTO subscriptions (id, user_id, plan_id, plan_name, status, started_at, expires_at, auto_renew) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(subId, payment.user_id, 'enterprise', '企业版(对公)', 'active', now, endDate.toISOString(), 1);
          // Also create a payment record
          db.prepare('INSERT INTO payments (id, user_id, subscription_id, amount, currency, payment_method, payment_status, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(randomUUID(), payment.user_id, subId, payment.amount, 'CNY', 'bank_transfer', 'success', now, now);
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Payment Config Management ======
  app.get('/api/admin/payment-config', adminAuth, (req, res) => {
    try {
      const configPath = path.resolve(__dirname, 'payment-config.json');
      let config = {};
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) { /* file may not exist */ }
      
      res.json({
        alipay: {
          enabled: config.alipay?.enabled || false,
          appId: config.alipay?.appId || '',
          notifyUrl: config.alipay?.notifyUrl || 'https://ide.zhejiangjinmo.com/api/payments/notify/alipay',
        },
        wechat: {
          enabled: config.wechat?.enabled || false,
          appId: config.wechat?.appId || '',
          mchId: config.wechat?.mchId || '',
          notifyUrl: config.wechat?.notifyUrl || 'https://ide.zhejiangjinmo.com/api/payments/notify/wechat',
        },
        bankTransfer: {
          bankName: config.bankTransfer?.bankName || '',
          bankAccount: config.bankTransfer?.bankAccount || '',
          accountName: config.bankTransfer?.accountName || '',
          remark: config.bankTransfer?.remark || '',
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/payment-config', adminAuth, async (req, res) => {
    try {
      const configPath = path.resolve(__dirname, 'payment-config.json');
      let existing = {};
      try {
        if (fs.existsSync(configPath)) {
          existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) { /* ignore */ }
      
      const { alipay, wechat, bankTransfer } = req.body;
      
      const newConfig = {
        ...existing,
        alipay: alipay ? { ...existing.alipay, ...alipay } : existing.alipay,
        wechat: wechat ? { ...existing.wechat, ...wechat } : existing.wechat,
        bankTransfer: bankTransfer ? { ...existing.bankTransfer, ...bankTransfer } : existing.bankTransfer,
      };
      
      // Preserve private keys if not provided in update
      if (alipay && alipay.privateKey) {
        newConfig.alipay.privateKey = alipay.privateKey;
      } else if (existing.alipay?.privateKey) {
        newConfig.alipay.privateKey = existing.alipay.privateKey;
      }
      if (wechat && wechat.apiKey) {
        newConfig.wechat.apiKey = wechat.apiKey;
      } else if (existing.wechat?.apiKey) {
        newConfig.wechat.apiKey = existing.wechat.apiKey;
      }
      
      // Auto-set enabled based on having required keys
      if (newConfig.alipay) {
        newConfig.alipay.enabled = !!(newConfig.alipay.appId && newConfig.alipay.privateKey);
      }
      if (newConfig.wechat) {
        newConfig.wechat.enabled = !!(newConfig.wechat.appId && newConfig.wechat.mchId && newConfig.wechat.apiKey);
      }
      
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
      console.log('[PaymentConfig] Saved:', configPath);
      
      res.json({ success: true, message: '支付配置已保存' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Invoices Management ======
  app.get('/api/admin/invoices', adminAuth, (req, res) => {
    try {
      const { status } = req.query;
      let sql = 'SELECT i.*, u.username as user_name FROM invoices i LEFT JOIN users u ON i.user_id = u.id';
      const params = [];
      if (status) {
        sql += ' WHERE i.status = ?';
        params.push(status);
      }
      const rows = db.prepare(sql + ' ORDER BY i.created_at DESC').all(...params);
      res.json(rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name || 'Unknown',
        paymentId: r.payment_id,
        amount: r.amount,
        companyName: r.company_name,
        taxId: r.tax_id,
        companyAddress: r.company_address,
        companyPhone: r.company_phone,
        bankName: r.bank_name,
        bankAccount: r.bank_account,
        email: r.email,
        status: r.status,
        invoiceNumber: r.invoice_number,
        issuedAt: r.issued_at,
        createdAt: r.created_at,
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/invoices/:id', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { status, invoiceNumber } = req.body;
      const updates = [];
      const params = [];
      if (status) { updates.push('status = ?'); params.push(status); }
      if (invoiceNumber) { updates.push('invoice_number = ?'); params.push(invoiceNumber); }
      if (status === 'issued' || status === 'approved') {
        updates.push('issued_at = ?');
        params.push(new Date().toISOString());
      }
      if (updates.length === 0) return res.status(400).json({ error: 'no_fields_to_update' });
      params.push(id);
      db.prepare('UPDATE invoices SET ' + updates.join(', ') + ' WHERE id = ?').run(...params);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== versions.json helpers ======
  function findVersionsJsonPath() {
    const searchPaths = [
      '/var/www/lingjing/versions.json',
      '/root/lingjing-update/data/versions.json',
      '/var/www/update-server/data/versions.json',
      '/opt/lingjing-update/data/versions.json',
      path.resolve(__dirname, '..', 'update-server', 'data', 'versions.json'),
      path.resolve(__dirname, '..', '..', 'var', 'www', 'update-server', 'data', 'versions.json'),
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  function findVersionsJsonDownloadPath() {
    const searchPaths = [
      '/var/www/html/downloads/versions.json',
      '/var/www/downloads/versions.json',
      '/var/www/lingjing/versions.json',  // same file, also the download page reads it
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  function readVersionsJson() {
    const p = findVersionsJsonPath();
    if (!p) return { latest: '0.0.0', versions: [] };
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return normalizeVersionsJson(data);
    } catch { return { latest: '0.0.0', versions: [] }; }
  }

  function normalizeVersionsJson(data) {
    if (data.versions && typeof data.versions === 'object' && !Array.isArray(data.versions)) {
      data.versions = Object.values(data.versions);
    }
    return data;
  }

  // All known versions.json paths on production — sync all on publish
  function getAllVersionsJsonPaths() {
    return [
      '/var/www/html/versions.json',                       // PRIMARY: Nginx download page (authoritative)
      '/var/www/downloads/versions.json',                  // Legacy download-list
      '/var/www/lingjing/versions.json',                   // cloud-server / lingjing-update-server
      '/var/www/update-server/data/versions.json',         // update-server:3000 fallback
      '/root/cloud-admin/server/data/versions.json',       // cloud-admin
      '/root/lingjing/update-server/data/versions.json',   // legacy update-server
      '/root/lingjing/versions.json',                      // legacy root
      '/root/lingjing-update/data/versions.json',          // lingjing-update
      '/root/lingjing-build/update-server/data/versions.json', // build server
      '/opt/lingjing-update-server/data/versions.json',    // update-server v2 data
      '/opt/lingjing-update-server/versions.json',         // update-server v2 root
      '/opt/lingjing-cloud-server/versions.json',          // cloud-server legacy
      '/opt/lingjing/update-server/data/versions.json',    // primary update-server
      '/opt/lingjing/update-server/versions.json',         // update-server root
      '/opt/lingjing-update/data/versions.json',           // lingjing-update data
    ];
  }

  function writeVersionsJson(data) {
    const json = JSON.stringify(data, null, 2);
    let written = 0;
    const allPaths = getAllVersionsJsonPaths();
    for (const p of allPaths) {
      try {
        // Ensure parent directory exists
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(p, json, 'utf8');
        written++;
        console.log('[Admin API] Updated versions.json:', p);
      } catch (e) {
        // Non-fatal: some paths may be on different mount points or read-only
        console.warn('[Admin API] Failed to write versions.json to', p, ':', e.message);
      }
    }
    if (written === 0) {
      console.error('[Admin API] CRITICAL: Failed to write versions.json to any path!');
      return false;
    }
    return true;
  }

  // ====== Storage formatting helper ======
  function formatStorage(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  // ====== Safe JSON Parse helper (local copy for module scope) ======
  function safeJsonParse(val, fallback) {
    if (val == null) return fallback;
    if (typeof val !== 'string') return val;
    try { return JSON.parse(val); } catch { return fallback; }
  }

  console.log('[Admin API] Routes initialized');
}
