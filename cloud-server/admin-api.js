/**
 * 灵境 Cloud Admin Management API
 * 管理后台专用 API 路由
 * 集成到 cloud-server，共享 SQLite 数据库
 */

import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { exec } from 'node:child_process';
import { subscribe as subscribeLogs } from './log-stream.js';

// ES module __dirname shim (for server.js-compatible path resolution)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Admin credentials (in production, use environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD_FILE = '/root/lingjing-cloud/.admin-password.json';
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
  return getAdminPasswordHash() === DEFAULT_PASSWORD_HASH;
}

const JWT_SECRET = process.env.JWT_SECRET || 'lingjing-jwt-secret-dev-only';

// Simple JWT for admin
function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function signAdminJWT(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const sig = createHash('sha256').update(`${header}.${body}${JWT_SECRET}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyAdminJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = createHash('sha256').update(`${header}.${body}${JWT_SECRET}`).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function registerAdminAPI(app, db) {
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

  // ====== Admin Login ======
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }
    
    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    
    const hash = createHash('sha256').update(password).digest('hex');
    if (hash !== getAdminPasswordHash()) {
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
      expiresIn: 24 * 60 * 60 * 1000
    });
  });

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
  app.get('/api/admin/stats', adminAuth, (req, res) => {
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
      
      // Tenant stats (if table exists)
      let tenantStats = { total: 0, active: 0, free: 0, pro: 0, enterprise: 0 };
      try {
        tenantStats.total = db.prepare('SELECT COUNT(*) as count FROM tenants').get()?.count || 0;
        tenantStats.active = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'").get()?.count || 0;
        tenantStats.free = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE plan = 'free'").get()?.count || 0;
        tenantStats.pro = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE plan = 'pro'").get()?.count || 0;
        tenantStats.enterprise = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE plan = 'enterprise'").get()?.count || 0;
      } catch (e) { /* tenants table may not exist */ }

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
        tenants: tenantStats,
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
  app.get('/api/admin/metrics', adminAuth, (req, res) => {
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

      exec('df -m /', { timeout: 5000 }, (err, stdout) => {
        let disk = { total_mb: 0, used_mb: 0, available_mb: 0, usage_percent: 0 };
        if (!err && stdout) {
          const parts = stdout.trim().split('\n')[1]?.split(/\s+/);
          if (parts && parts.length >= 6) {
            disk = {
              total_mb: parseInt(parts[1]) || 0,
              used_mb: parseInt(parts[2]) || 0,
              available_mb: parseInt(parts[3]) || 0,
              usage_percent: parseInt(parts[4].replace('%', '')) || 0
            };
          }
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
      
      if (status) {
        query += ' WHERE status = ?';
        countQuery += ' WHERE status = ?';
        params.push(status);
        countParams.push(status);
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

  // ====== Tenant Management ======
  app.get('/api/admin/tenants', adminAuth, (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = 'SELECT * FROM tenants';
      let countQuery = 'SELECT COUNT(*) as total FROM tenants';
      const params = [];
      if (status) {
        query += ' WHERE status = ?';
        countQuery += ' WHERE status = ?';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);
      const tenants = db.prepare(query).all(...params);
      const { total } = status ? db.prepare(countQuery).get(status) : db.prepare(countQuery).get() || { total: 0 };
      res.json({ tenants, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/tenants', adminAuth, (req, res) => {
    try {
      const { name, email, plan = 'free' } = req.body;
      if (!name) return res.status(400).json({ error: 'name required' });
      const id = randomUUID();
      const now = new Date().toISOString();
      const apiKey = `lj_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const quotaMap = { free: { api: 1000, storage: 100, sessions: 50 }, pro: { api: 10000, storage: 1024, sessions: 200 }, enterprise: { api: 999999, storage: 10240, sessions: 99999 } };
      const quota = quotaMap[plan] || quotaMap.free;
      db.prepare('INSERT INTO tenants (id, name, email, plan, status, quota_api_calls, quota_storage_mb, quota_sessions, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, email || '', plan, 'active', quota.api, quota.storage, quota.sessions, apiKey, now, now);
      res.status(201).json({ id, name, email, plan, status: 'active', apiKey, createdAt: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/tenants/:id', adminAuth, (req, res) => {
    try {
      const { name, email, plan, status } = req.body;
      const updates = [];
      const params = [];
      if (name) { updates.push('name = ?'); params.push(name); }
      if (email) { updates.push('email = ?'); params.push(email); }
      if (plan) { updates.push('plan = ?'); params.push(plan); }
      if (status) { updates.push('status = ?'); params.push(status); }
      if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(req.params.id);
      db.prepare(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/tenants/:id', adminAuth, (req, res) => {
    try {
      db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
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

  // ====== Legacy API endpoints (for backward compatibility) ======
  // These endpoints bridge the gap between the old /api/* pattern and the new /api/admin/* pattern

  // GET /api/health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ====== Users (from `users` table) ======
  app.get('/api/users', adminAuth, (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, username as name, email, 'user' as role, 'active' as status, registered_at as createdAt, last_login_at
        FROM users ORDER BY registered_at DESC
      `).all();
      const total = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
      res.json(users);
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
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, password_salt, registered_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, username, email, 'placeholder', 'placeholder', now);
      res.json({ id, username, email, createdAt: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/users/:id', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, password_strength, status } = req.body;
      const updates = [];
      const params = [];
      if (name) { updates.push("username = ?"); params.push(name); }
      if (email) { updates.push("email = ?"); params.push(email); }
      if (password_strength) { updates.push("password_strength = ?"); params.push(password_strength); }
      if (status) { updates.push("status = ?"); params.push(status); }
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

  // ====== Versions (no dedicated table - return configured version) ======
  app.get('/api/versions', adminAuth, (req, res) => {
    try {
      const data = readVersionsJson();
      if (!data || !data.versions || data.versions.length === 0) {
        return res.json([]);
      }
      // Map versions.json entries to the expected format, including status
      const result = data.versions.map((v, idx) => ({
        id: v.version || 'v-' + idx,
        version: v.version || '0.0.0',
        releaseDate: v.releaseDate || v.date || null,
        changelog: v.releaseNotes || v.description || v.changelog || '',
        downloadUrl: v.files ? (typeof v.files['win-x64'] === 'string' ? 'https://ide.zhejiangjinmo.com/downloads/' + v.files['win-x64'] : (v.files['win-x64'] && v.files['win-x64'].url ? v.files['win-x64'].url : '')) : (v.downloadUrl || ''),
        active: v.status === 'published' || v.status !== 'draft',
        status: v.status || 'published',
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  app.post('/api/versions', adminAuth, (req, res) => {
    try {
      const { version, changelog, downloadUrl } = req.body;
      if (!version) return res.status(400).json({ error: 'version required' });
      const data = readVersionsJson();
      const now = new Date().toISOString();
      
      // Check if version already exists
      const existingIdx = data.versions.findIndex(v => v.version === version);
      const entry = {
        version,
        releaseDate: now,
        releaseNotes: changelog || '灵境IDE v' + version,
        downloadUrl: downloadUrl || '',
        files: {},
        status: 'draft',  // Default to draft - requires admin review to publish
      };
      
      if (existingIdx >= 0) {
        data.versions[existingIdx] = { ...data.versions[existingIdx], ...entry };
      } else {
        data.versions.unshift(entry);
      }
      
      writeVersionsJson(data);
      console.log('[Admin API] Version created:', version, '(draft)');
      res.json({ version, releaseDate: now, status: 'draft' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  app.put('/api/versions/:id', adminAuth, (req, res) => {
    try {
      const { id } = req.params;
      const { version, changelog, downloadUrl, active } = req.body;
      try {
        db.prepare("INSERT OR REPLACE INTO db_config (key, value) VALUES ('current_version', ?)").run(version || '0.0.0');
      } catch (e) { /* table may not exist */ }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Publish a version (pending_review or draft → published) ======
  app.post('/api/versions/:version/publish', adminAuth, (req, res) => {
    try {
      const { version } = req.params;
      if (!version) return res.status(400).json({ error: 'version required' });
      
      const data = readVersionsJson();
      const existingIdx = data.versions.findIndex(v => v.version === version);
      
      if (existingIdx < 0) {
        return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
      }
      
      if (data.versions[existingIdx].status === 'published') {
        return res.json({ ok: true, version, status: 'published', message: '版本已发布，无需重复操作' });
      }
      if (data.versions[existingIdx].status !== 'pending_review' && data.versions[existingIdx].status !== 'draft') {
        return res.status(400).json({ error: 'invalid_status', message: '仅待审核或草稿版本可发布' });
      }
      
      // Mark as published
      data.versions[existingIdx].status = 'published';
      data.versions[existingIdx].publishedAt = new Date().toISOString();
      
      // Do NOT update latest pointer — keep it pointing to current published version
      // /api/latest only shows published versions (see readVersionInfo() in server.js)
      // data.latest = version;
      
      // Write to both versions.json files (API + download page)
      writeVersionsJson(data);
      
      // Promote draft latest.yml to live latest.yml (if draft file exists)
      const downloadDir = '/var/www/html/downloads/';
      const draftYml = path.join(downloadDir, 'latest-draft-' + version + '.yml');
      const liveYml = path.join(downloadDir, 'latest.yml');
      if (fs.existsSync(draftYml)) {
        // Backup current latest.yml
        if (fs.existsSync(liveYml)) {
          fs.copyFileSync(liveYml, liveYml + '.bak');
        }
        fs.copyFileSync(draftYml, liveYml);
        fs.unlinkSync(draftYml);
        console.log('[Admin API] latest.yml promoted to:', version);
      }

      // Promote draft latest-linux.yml to live latest-linux.yml (Linux builds)
      const draftLinuxYml = path.join(downloadDir, 'latest-linux-draft-' + version + '.yml');
      const liveLinuxYml = path.join(downloadDir, 'latest-linux.yml');
      if (fs.existsSync(draftLinuxYml)) {
        if (fs.existsSync(liveLinuxYml)) {
          fs.copyFileSync(liveLinuxYml, liveLinuxYml + '.bak');
        }
        fs.copyFileSync(draftLinuxYml, liveLinuxYml);
        fs.unlinkSync(draftLinuxYml);
        console.log('[Admin API] latest-linux.yml promoted to:', version);
      }
      
      console.log('[Admin API] Version published:', version);
      res.json({ ok: true, version, status: 'published', message: '版本已成功发布' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Submit a draft version for review (draft → pending_review) ======
  app.post('/api/versions/:version/submit-review', adminAuth, (req, res) => {
    try {
      const { version } = req.params;
      if (!version) return res.status(400).json({ error: 'version required' });
      
      const data = readVersionsJson();
      const existingIdx = data.versions.findIndex(v => v.version === version);
      
      if (existingIdx < 0) {
        return res.status(404).json({ error: 'version_not_found', message: '版本不存在' });
      }
      
      const currentStatus = data.versions[existingIdx].status;
      if (currentStatus === 'published') {
        return res.json({ ok: true, version, status: 'published', message: '版本已发布，无需审核' });
      }
      if (currentStatus === 'pending_review') {
        return res.json({ ok: true, version, status: 'pending_review', message: '版本已在审核中' });
      }
      
      // Mark as pending_review
      data.versions[existingIdx].status = 'pending_review';
      data.versions[existingIdx].submittedAt = new Date().toISOString();
      
      // Update latest pointer so /api/latest returns this version
      data.latest = version;
      
      // Write to versions.json (do NOT promote YAML files — keep latest.yml pointing to current published version)
      writeVersionsJson(data);
      
      console.log('[Admin API] Version submitted for review:', version);
      res.json({ ok: true, version, status: 'pending_review', message: '版本已提交审核' });
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
      const subscriptions = db.prepare(`
        SELECT s.*, u.username as userName, u.email as userEmail
        FROM subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.started_at DESC
      `).all();
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
      res.json(mapped);
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
      let sql = 'SELECT p.*, u.username as user_name FROM payments p LEFT JOIN users u ON p.user_id = u.id';
      const where = [];
      const params = [];
      if (status) { where.push('p.payment_status = ?'); params.push(status); }
      if (method) { where.push('p.payment_method = ?'); params.push(method); }
      if (where.length > 0) sql += ' WHERE ' + where.join(' AND ');
      sql += ' ORDER BY p.created_at DESC LIMIT 200';
      const payments = db.prepare(sql).all(...params);
      res.json(payments.map(p => ({
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
      })));
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

  function writeVersionsJson(data) {
    const apiPath = findVersionsJsonPath();
    const dlPath = findVersionsJsonDownloadPath();
    const json = JSON.stringify(data, null, 2);
    if (apiPath) {
      fs.writeFileSync(apiPath, json, 'utf8');
      console.log('[Admin API] Updated versions.json:', apiPath);
    }
    if (dlPath) {
      fs.writeFileSync(dlPath, json, 'utf8');
      console.log('[Admin API] Updated download versions.json:', dlPath);
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
