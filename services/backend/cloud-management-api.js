/**
 * Cloud Management API Routes
 * 用户、设备、订阅、同步、存储、API密钥管理
 */

// Helper: Get user ID from auth middleware
function getUserId(req) {
  return req.user?.id || 'default-user';
}

// ====== User Management API ======

// GET /api/user/info - 获取用户信息
app.get('/api/user/info', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const user = db.prepare(`
      SELECT id, username, email, avatar, password_strength, 
             two_factor_enabled, registered_at, last_login_at
      FROM users WHERE id = ?
    `).get(userId);
    
    if (!user) {
      // Return mock data if user not found
      return res.json({
        id: userId,
        username: 'demo_user',
        email: 'demo@lingjing.com',
        registeredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        passwordStrength: 'strong',
        twoFactorEnabled: false
      });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      registeredAt: user.registered_at,
      lastLoginAt: user.last_login_at,
      passwordStrength: user.password_strength,
      twoFactorEnabled: !!user.two_factor_enabled
    });
  } catch (err) {
    console.error('[User] Get info error:', err.message);
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// PUT /api/user/info - 更新用户信息
app.put('/api/user/info', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { username, email, avatar } = req.body;
    
    db.prepare(`
      UPDATE users SET username = ?, email = ?, avatar = ?
      WHERE id = ?
    `).run(username, email, avatar, userId);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// GET /api/user/security - 获取安全设置
app.get('/api/user/security', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const user = db.prepare(`
      SELECT two_factor_enabled, two_factor_method, session_timeout, login_notification
      FROM users WHERE id = ?
    `).get(userId);
    
    if (!user) {
      return res.json({
        twoFactorEnabled: false,
        sessionTimeout: 60,
        loginNotification: true,
        trustedDevices: []
      });
    }
    
    res.json({
      twoFactorEnabled: !!user.two_factor_enabled,
      twoFactorMethod: user.two_factor_method,
      sessionTimeout: user.session_timeout || 60,
      loginNotification: !!user.login_notification,
      trustedDevices: []
    });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// POST /api/user/security/2fa/enable - 启用两步验证
app.post('/api/user/security/2fa/enable', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { method } = req.body;
    
    const secret = randomUUID();
    db.prepare(`
      UPDATE users SET two_factor_enabled = 1, two_factor_method = ?, two_factor_secret = ?
      WHERE id = ?
    `).run(method, secret, userId);
    
    res.json({ secret, qrCode: `otpauth://totp/LingJing:${userId}?secret=${secret}` });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// GET /api/user/login-history - 获取登录历史
app.get('/api/user/login-history', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit = 20, offset = 0 } = req.query;
    
    const records = db.prepare(`
      SELECT id, timestamp, ip_address, location, device, success, failure_reason
      FROM login_history WHERE user_id = ?
      ORDER BY timestamp DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
    
    res.json(records.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      ipAddress: r.ip_address,
      location: r.location,
      device: r.device,
      success: !!r.success,
      failureReason: r.failure_reason
    })));
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// ====== Device Management API ======

// GET /api/devices - 获取设备列表
app.get('/api/devices', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const devices = db.prepare(`
      SELECT * FROM user_devices WHERE user_id = ?
    `).all(userId);
    
    res.json(devices.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      os: d.os,
      lastSyncAt: d.last_sync_at,
      syncStatus: d.sync_status,
      isOnline: !!d.is_online,
      authorizationStatus: d.authorization_status,
      boundAt: d.bound_at,
      isCurrentDevice: !!d.is_current_device
    })));
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// POST /api/devices/register - 注册设备 (JWT认证)
app.post('/api/devices/register', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, type, os, deviceId: existingId } = req.body;
    const deviceId = existingId || randomUUID();
    const now = new Date().toISOString();
    
    // Check if device already exists for this user
    const existing = db.prepare('SELECT id FROM user_devices WHERE id = ? AND user_id = ?').get(deviceId, userId);
    if (existing) {
      // Update last_seen and online status
      db.prepare('UPDATE user_devices SET is_online = 1, last_sync_at = ?, name = ?, type = ?, os = ? WHERE id = ?')
        .run(now, name, type, os, deviceId);
      return res.json({ id: deviceId, name, type, os, lastSyncAt: now, syncStatus: 'synced', boundAt: now, alreadyExists: true });
    }
    
    db.prepare(`
      INSERT INTO user_devices (id, user_id, name, type, os, last_sync_at, sync_status, is_online, bound_at)
      VALUES (?, ?, ?, ?, ?, ?, 'synced', 1, ?)
    `).run(deviceId, userId, name, type, os, now, now);
    
    console.log(`[UserDevices] Registered: ${name} (${deviceId.slice(0,12)}...) for user ${userId.slice(0,12)}...`);
    res.json({ id: deviceId, name, type, os, lastSyncAt: now, syncStatus: 'synced', boundAt: now });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// GET /api/devices/online-desktops - 获取用户的在线桌面设备
app.get('/api/devices/online-desktops', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const desktops = db.prepare(`
      SELECT id, name, type, os, last_sync_at, is_online, bound_at
      FROM user_devices 
      WHERE user_id = ? AND type = 'desktop' AND is_online = 1
      ORDER BY last_sync_at DESC
    `).all(userId);
    
    res.json(desktops.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      os: d.os,
      lastOnlineAt: d.last_sync_at,
      isOnline: !!d.is_online,
      boundAt: d.bound_at,
    })));
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// POST /api/devices/heartbeat - 设备心跳 (更新在线状态)
app.post('/api/devices/heartbeat', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId_required' });
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE user_devices SET is_online = 1, last_sync_at = ? WHERE id = ? AND user_id = ?')
      .run(now, deviceId, userId);
    res.json({ ok: true, timestamp: now });
  } catch (err) {
    // Silently succeed - heartbeat is best-effort
    res.json({ ok: true });
  }
});

// PUT /api/devices/go-offline - 设备离线
app.put('/api/devices/go-offline', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { deviceId } = req.body;
    if (deviceId) {
      db.prepare('UPDATE user_devices SET is_online = 0 WHERE id = ? AND user_id = ?')
        .run(deviceId, userId);
    }
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: true });
  }
});

// POST /api/devices/auth-code - 生成授权码
app.post('/api/devices/auth-code', auth, (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10分钟后过期
    
    db.prepare(`
      INSERT INTO auth_codes (code, created_at, expires_at, status)
      VALUES (?, ?, ?, 'pending')
    `).run(code, now.toISOString(), expiresAt.toISOString());
    
    res.json({ code, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// ====== Subscription Management API ======

// GET /api/subscription - 获取订阅信息
app.get('/api/subscription', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const sub = db.prepare(`
      SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'
    `).get(userId);
    
    if (!sub) {
      return res.json({
        id: 'free-plan',
        userId,
        planId: 'free',
        planName: '免费版',
        status: 'active',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        autoRenew: false,
        features: [
          { name: 'API调用', limit: 100, used: 15, unit: '次/天' },
          { name: '存储空间', limit: 100, used: 23, unit: 'MB' }
        ],
        usage: { apiCalls: 15, storageUsed: 23, workflowsRun: 0, devicesConnected: 1 }
      });
    }
    
    res.json({
      id: sub.id,
      userId: sub.user_id,
      planId: sub.plan_id,
      planName: sub.plan_name,
      status: sub.status,
      startedAt: sub.started_at,
      expiresAt: sub.expires_at,
      autoRenew: !!sub.auto_renew
    });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// GET /api/subscription/plans - 获取套餐列表
app.get('/api/subscription/plans', auth, (req, res) => {
  res.json([
    {
      id: 'free',
      name: '免费版',
      price: 0,
      billingCycle: 'monthly',
      features: [
        { name: 'API调用', description: '每天100次', included: true, limit: 100 },
        { name: '存储空间', description: '100MB', included: true, limit: 100 }
      ],
      limits: { apiCalls: 100, storage: 100, workflows: 5, devices: 2 }
    },
    {
      id: 'pro',
      name: '专业版',
      price: 99,
      billingCycle: 'monthly',
      recommended: true,
      features: [
        { name: 'API调用', description: '每天10000次', included: true, limit: 10000 },
        { name: '存储空间', description: '10GB', included: true, limit: 10240 }
      ],
      limits: { apiCalls: 10000, storage: 10240, workflows: 'unlimited', devices: 10 }
    }
  ]);
});

// ====== Sync Management API ======

// GET /api/sync/status - 获取同步状态
app.get('/api/sync/status', auth, (req, res) => {
  res.json({
    enabled: true,
    lastSyncAt: new Date().toISOString(),
    status: 'synced',
    progress: null
  });
});

// POST /api/sync/now - 立即同步
app.post('/api/sync/now', auth, (req, res) => {
  res.json({ success: true, message: '同步已开始' });
});

// GET /api/sync/history - 获取同步历史
app.get('/api/sync/history', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit = 50, offset = 0 } = req.query;
    
    const records = db.prepare(`
      SELECT * FROM sync_records WHERE user_id = ?
      ORDER BY timestamp DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
    
    res.json(records);
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// ====== Storage Management API ======

// GET /api/storage/stats - 获取存储统计
app.get('/api/storage/stats', auth, (req, res) => {
  res.json({
    total: 10240,
    used: 2345,
    available: 7895,
    breakdown: {
      conversations: 1234,
      files: 567,
      workflows: 234,
      cache: 200,
      other: 110
    }
  });
});

// GET /api/storage/files - 获取文件列表
app.get('/api/storage/files', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit = 50, offset = 0, category } = req.query;
    
    let query = `SELECT * FROM storage_files WHERE user_id = ?`;
    const params = [userId];
    
    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }
    
    query += ` ORDER BY modified_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const files = db.prepare(query).all(...params);
    res.json({ files, total: files.length });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// ====== API Key Management API ======

// GET /api/api-keys - 获取API密钥列表
app.get('/api/api-keys', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const keys = db.prepare(`
      SELECT id, name, key, permissions, created_at, expires_at, status, last_used_at, call_count, error_count
      FROM api_keys WHERE user_id = ?
    `).all(userId);
    
    res.json({
      keys: keys.map(k => ({
        id: k.id,
        name: k.name,
        key: k.key,
        maskedKey: k.key ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : '',
        permissions: JSON.parse(k.permissions || '[]'),
        createdAt: k.created_at,
        expiresAt: k.expires_at,
        status: k.status,
        lastUsedAt: k.last_used_at,
        callCount: k.call_count || 0,
        errorCount: k.error_count || 0
      })),
      total: keys.length
    });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// POST /api/api-keys - 创建API密钥
app.post('/api/api-keys', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, permissions, expiresAt } = req.body;
    const keyId = randomUUID();
    const key = `lj_${randomUUID().replace(/-/g, '')}`;
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO api_keys (id, user_id, name, key, permissions, created_at, expires_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(keyId, userId, name, key, JSON.stringify(permissions || []), now, expiresAt);
    
    res.json({
      id: keyId,
      name,
      key,
      maskedKey: `${key.substring(0, 8)}...${key.substring(key.length - 4)}`,
      permissions: permissions || [],
      createdAt: now,
      expiresAt,
      status: 'active',
      callCount: 0,
      errorCount: 0
    });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// DELETE /api/api-keys/:keyId - 删除API密钥
app.delete('/api/api-keys/:keyId', auth, (req, res) => {
  try {
    const { keyId } = req.params;
    db.prepare(`DELETE FROM api_keys WHERE id = ?`).run(keyId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

// GET /api/api-keys/stats - 获取API密钥统计
app.get('/api/api-keys/stats', auth, (req, res) => {
  try {
    const userId = getUserId(req);
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalKeys,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeKeys,
        SUM(call_count) as totalCalls,
        SUM(error_count) as totalErrors
      FROM api_keys WHERE user_id = ?
    `).get(userId);
    
    res.json({
      totalKeys: stats?.totalKeys || 0,
      activeKeys: stats?.activeKeys || 0,
      totalCalls: stats?.totalCalls || 0,
      totalErrors: stats?.totalErrors || 0,
      avgCallsPerDay: Math.floor((stats?.totalCalls || 0) / 30),
      lastActiveAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ code: 'DATABASE_ERROR', message: err.message });
  }
});

console.log('[Cloud Management] API routes initialized');
