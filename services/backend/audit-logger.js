import { randomUUID } from 'node:crypto';

export function createAuditLogger(db) {
  function log(entry) {
    try {
      const id = entry.id || randomUUID();
      const channel = 'audit';
      const payload = JSON.stringify({
        action: entry.action || 'unknown',
        resource: entry.resource || '',
        userId: entry.userId || null,
        ip: entry.ip || null,
        method: entry.method || null,
        path: entry.path || null,
        statusCode: entry.statusCode || null,
        detail: entry.detail || null,
        timestamp: entry.timestamp || new Date().toISOString(),
      });
      const receivedAt = entry.timestamp || new Date().toISOString();
      db.prepare('INSERT INTO webhook_logs (id, channel, payload, received_at) VALUES (?, ?, ?, ?)')
        .run(id, channel, payload, receivedAt);
    } catch (err) {
      console.error('[AuditLogger] Failed to write audit log:', err.message);
    }
  }

  function middleware(req, res, next) {
    const startTime = Date.now();
    res.on('finish', () => {
      if (req.path?.startsWith('/api/')) {
        log({
          action: `${req.method} ${req.path}`,
          resource: req.path,
          userId: req.userId || req.admin?.sub || null,
          ip: req.headers['x-real-ip'] || req.ip || null,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          detail: `duration:${Date.now() - startTime}ms`,
        });
      }
    });
    next();
  }

  function query(filter = {}) {
    try {
      let sql = "SELECT * FROM webhook_logs WHERE channel = 'audit'";
      const params = [];
      if (filter.action) { sql += ' AND payload LIKE ?'; params.push(`%"action":"${filter.action}"%`); }
      if (filter.userId) { sql += ' AND payload LIKE ?'; params.push(`%"userId":"${filter.userId}"%`); }
      if (filter.from) { sql += ' AND received_at >= ?'; params.push(filter.from); }
      if (filter.to) { sql += ' AND received_at <= ?'; params.push(filter.to); }
      sql += ' ORDER BY received_at DESC';
      const limit = Math.min(100, Math.max(1, filter.limit || 50));
      const offset = Math.max(0, filter.offset || 0);
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
      const rows = db.prepare(sql).all(...params);
      return rows.map(r => {
        try { return { ...r, payload: JSON.parse(r.payload) }; } catch { return r; }
      });
    } catch (err) {
      console.error('[AuditLogger] Query failed:', err.message);
      return [];
    }
  }

  return { middleware, log, query };
}